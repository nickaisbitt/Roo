import 'dotenv/config.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import dayjs from 'dayjs';
import tz from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc); dayjs.extend(tz);
import { readTable, writeBack } from './google.js';
import { EPISODE_STRUCTURES, createSectionPrompt, createTitlePrompt, createDescriptionPrompt, createHTMLDescriptionPrompt, createTagsPrompt } from './prompts.js';
import { chatComplete } from './openai-text.js';
import { synthesizeToMp3 } from './tts.js';
import { coerceBoolean, parsePublishDateDDMMYYYY, withinNextNDays, wordCount, sanitizeTags } from './utils.js';
import { refreshAccessToken, uploadEpisode } from './spreaker.js';

const SPREADSHEET_ID=process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const TAB_NAME=process.env.GOOGLE_SHEETS_TAB_NAME;
const SHOW_ID=process.env.SPREAKER_SHOW_ID;
const MAX_EPISODES=parseInt(process.env.MAX_EPISODES_PER_RUN||'2',10);
const DRY=coerceBoolean(process.env.DRY_RUN||'false');
const TZ=process.env.EPISODE_TIMEZONE||'UTC';
const PUBLISH_TIME=process.env.SPREAKER_PUBLISH_TIME_UTC||'08:00:00';

function pickEpisodeType(v){const s=(v||'').toLowerCase(); if(s.includes('fri')) return 'friday'; return s.includes('main')?'main':'main';}

async function generateEpisodePackage({episodeType,input}){
  const sections=EPISODE_STRUCTURES[episodeType]; let combined=''; const completed=[];
  for(let i=0;i<sections.length;i++){ const sec=sections[i]; const prompt=createSectionPrompt(sec,input,completed,i,sections.length);
    const content=await chatComplete([{role:'user',content:prompt}],{max_tokens:Math.round(sec.target*1.6)});
    const wc=wordCount(content); completed.push({name:sec.name,content,wc}); combined+=(i?'\n\n':'')+content; }
  const title=await chatComplete([{role:'user',content:createTitlePrompt(combined)}],{max_tokens:64,temperature:0.6});
  const description=await chatComplete([{role:'user',content:createDescriptionPrompt(combined)}],{max_tokens:900,temperature:0.7});
  const htmlDesc=await chatComplete([{role:'user',content:createHTMLDescriptionPrompt(combined)}],{max_tokens:900,temperature:0.7});
  const tags=await chatComplete([{role:'user',content:createTagsPrompt(combined)}],{max_tokens:200,temperature:0.4});
  if(!combined.toLowerCase().includes('supporters club')){
    combined += "\n\nIf this podcast helps you make sense of your shit, join our Supporters Club to go ad-free and help us keep these conversations going. You can find the link to join in the episode description.";
  }
  return { script: combined, title: title.trim().replace(/^"|"$/g,''), description, htmlDesc, tags: sanitizeTags(tags) };
}

async function main(){
  console.log('Starting weekly run...');
  console.log(`Environment: EPISODE_TIMEZONE=${TZ}, MAX_EPISODES=${MAX_EPISODES}, DRY_RUN=${DRY}`);
  if(!SPREADSHEET_ID||!TAB_NAME) throw new Error('Missing Google Sheet env vars.');
  if(!SHOW_ID) throw new Error('Missing SPREAKER_SHOW_ID.');
  
  console.log(`Reading Google Sheet: ${SPREADSHEET_ID}, tab: ${TAB_NAME}`);
  const { headers, rows } = await readTable({ spreadsheetId: SPREADSHEET_ID, tabName: TAB_NAME });
  console.log(`Read ${rows.length} rows from Google Sheet`);
  
  const get=(row,name)=>row[name.toLowerCase()]??row[name]??'';
  const candidates=[];
  let skippedInvalidDate = 0;
  let skippedOutOfRange = 0;
  let skippedAlreadyGenerated = 0;
  let skippedEmptyDate = 0;
  
  for(const row of rows){
    const generated=get(row,'generated');
    
    // Extract date values and determine which column provided the value
    const pubDateField = get(row,'publish_date');
    const dateField = get(row,'date'); 
    const episodeDateField = get(row,'episode date');
    const publishField = get(row,'publish');
    
    const pubRaw = pubDateField || dateField || episodeDateField || publishField;
    
    // Determine which column name was used for the date (matching extraction logic exactly)
    let dateColumnUsed = 'none';
    if (pubDateField) dateColumnUsed = 'publish_date';
    else if (dateField) dateColumnUsed = 'date';
    else if (episodeDateField) dateColumnUsed = 'episode date';
    else if (publishField) dateColumnUsed = 'publish';
    
    const parseResult=parsePublishDateDDMMYYYY(pubRaw,TZ);
    
    if(!parseResult.date) {
      // Handle completely empty date rows differently to reduce log noise
      if (parseResult.type === 'empty' && dateColumnUsed === 'none') {
        skippedEmptyDate++;
        // Skip logging individual empty date rows to reduce noise
      } else {
        skippedInvalidDate++;
        console.log(`Row ${row._rowIndex}: Skipped - Invalid date. Column: ${dateColumnUsed}, Value: "${pubRaw}", Error: ${parseResult.error}`);
      }
      continue;
    }
    if(!withinNextNDays(parseResult.date,63)) {
      skippedOutOfRange++;
      console.log(`Row ${row._rowIndex}: Skipped - Out of range. Date: ${parseResult.date.format('YYYY-MM-DD')}, Column: ${dateColumnUsed}`);
      continue;
    }
    
    // Only skip if generated field is explicitly TRUE/YES/1, treat empty/blank as NOT generated
    const isExplicitlyGenerated = generated && generated.toString().trim() !== '' && coerceBoolean(generated);
    if(isExplicitlyGenerated) {
      skippedAlreadyGenerated++;
      console.log(`Row ${row._rowIndex}: Skipped - Already generated. Generated field: "${generated}"`);
      continue;
    }
    
    // Add the date to the row for later use
    row._parsedDate = parseResult.date;
    candidates.push(row);
  }
  
  console.log(`Found ${candidates.length} candidate rows.`);
  console.log(`Skipped: ${skippedInvalidDate} invalid dates, ${skippedOutOfRange} out of range, ${skippedAlreadyGenerated} already generated, ${skippedEmptyDate} empty dates`);
  
  // Log sample of processed vs skipped dates for debugging
  if (candidates.length > 0) {
    console.log(`Sample of valid dates found:`);
    candidates.slice(0, 3).forEach(row => {
      const pubRaw=get(row,'publish_date')||get(row,'date')||get(row,'episode date')||get(row,'publish');
      console.log(`  Row ${row._rowIndex}: "${pubRaw}" -> ${row._parsedDate.format('YYYY-MM-DD')}`);
    });
  }
  
  const toProcess=candidates.slice(0,MAX_EPISODES);
  if (candidates.length > MAX_EPISODES) {
    console.log(`Processing first ${MAX_EPISODES} candidates (${candidates.length - MAX_EPISODES} will be processed in next run)`);
  }
  
  // If no episodes to process, exit gracefully without attempting OAuth refresh
  if (toProcess.length === 0) {
    console.log('No episodes to process. Exiting gracefully.');
    return;
  }
  
  let accessToken=null;
  if(!DRY){ 
    try {
      const tokenResult = await refreshAccessToken({ client_id:process.env.SPREAKER_CLIENT_ID, client_secret:process.env.SPREAKER_CLIENT_SECRET, refresh_token:process.env.SPREAKER_REFRESH_TOKEN }); 
      accessToken = typeof tokenResult === 'string' ? tokenResult : tokenResult.access_token;
    } catch (error) {
      console.error('❌ OAuth token refresh failed. Exiting gracefully to prevent restart loop.');
      console.error('   Please check your SPREAKER_REFRESH_TOKEN environment variable and regenerate if needed.');
      console.error('   Service will not auto-restart to avoid burning through tokens.');
      return; // Exit gracefully without crashing
    }
  }
  for(const row of toProcess){
    // Use cached date from filtering phase, or re-parse if needed
    let publishDate = row._parsedDate;
    if (!publishDate) {
      const parseResult = parsePublishDateDDMMYYYY(get(row,'publish_date')||get(row,'date')||get(row,'episode date')||get(row,'publish'),TZ);
      publishDate = parseResult.date;
    }
    
    const topic=get(row,'topic')||get(row,'title')||get(row,'episode topic')||get(row,'episode title')||'Untitled';
    const type=pickEpisodeType(get(row,'type')||get(row,'episode_type')||get(row,'episode type'));
    const inputString = `${publishDate.format('DD/MM/YYYY')} ${type==='main'?'Main Podcast':'Friday Healing'} **${topic}** ${topic}`;
    console.log(`Generating episode for row ${row._rowIndex} (${topic}) type=${type} date=${publishDate.format('YYYY-MM-DD')}`);
    const pkg=await generateEpisodePackage({ episodeType:type, input:inputString });
    const audioPath=path.join(os.tmpdir(),`episode_${Date.now()}.mp3`);
    if(!DRY){ await synthesizeToMp3(pkg.script,audioPath,'fable'); } else { fs.writeFileSync(audioPath,''); }
    const autoUtc = publishDate.utc().format('YYYY-MM-DD') + ' ' + (PUBLISH_TIME||'08:00:00');
    let uploaded={ episodeId:'DRY-RUN', raw:{} };
    if(!DRY){
      console.log(`Attempting to upload episode for row ${row._rowIndex}...`);
      try {
        uploaded=await uploadEpisode({ accessToken, showId:SHOW_ID, filePath:audioPath, title:pkg.title, description:pkg.htmlDesc||pkg.description, tags:pkg.tags, autoPublishedAtUtc:autoUtc });
        console.log(`Successfully uploaded episode for row ${row._rowIndex}: ${uploaded.episodeId}`);
      } catch (error) {
        console.error(`Error uploading episode for row ${row._rowIndex}:`, error.message);
        
        // Check if error is related to readable stream issues
        if (error.message && (error.message.includes('stream') || error.message.includes('Stream') || error.message.includes('readable') || error.message.includes('destroyed'))) {
          console.error(`STREAM ERROR DETECTED for row ${row._rowIndex}: ${error.message}`);
          console.error('This appears to be a readable stream related error. Stack trace:', error.stack);
        }
        
        // Check if error is related to FormData issues
        if (error.message && (error.message.includes('FormData') || error.message.includes('form-data') || error.message.includes('boundary') || error.message.includes('multipart'))) {
          console.error(`FORMDATA ERROR DETECTED for row ${row._rowIndex}: ${error.message}`);
          console.error('This appears to be a FormData related error. Stack trace:', error.stack);
        }
        
        // Log additional context for debugging
        console.error(`Upload attempt context for row ${row._rowIndex}:`);
        console.error(`- Audio file path: ${audioPath}`);
        console.error(`- File exists: ${fs.existsSync(audioPath)}`);
        if (fs.existsSync(audioPath)) {
          const stats = fs.statSync(audioPath);
          console.error(`- File size: ${stats.size} bytes`);
        }
        
        // Re-throw the error to maintain existing error handling behavior
        throw error;
      }
    }
    const episodeUrl = uploaded.episodeId && uploaded.episodeId!=='DRY-RUN' ? `https://www.spreaker.com/episode/${uploaded.episodeId}` : '';
    await writeBack({ spreadsheetId:SPREADSHEET_ID, tabName:TAB_NAME, rowIndex:row._rowIndex, headers, data:{ generated:'TRUE', spreaker_episode_id:uploaded.episodeId||'', spreaker_url:episodeUrl, generated_at:new Date().toISOString() } });
    console.log(`Row ${row._rowIndex} done -> episode_id=${uploaded.episodeId}`);
  }
  console.log('Run complete.');
}

main().catch(err=>{ console.error('Fatal error:', err); process.exit(1); });
