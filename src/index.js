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

// Token state management - maintains current refresh token during process execution
let currentRefreshToken = process.env.SPREAKER_REFRESH_TOKEN;
let currentAccessToken = null;
let tokenExpiresAt = null;
let refreshInProgress = false;

/**
 * Get current token status for debugging and monitoring
 * @returns {Object} Token status information
 */
function getTokenStatus() {
  return {
    hasRefreshToken: !!currentRefreshToken,
    hasAccessToken: !!currentAccessToken,
    isExpired: isTokenExpired(),
    expiresAt: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null,
    refreshInProgress: refreshInProgress,
    refreshTokenLastChars: currentRefreshToken ? currentRefreshToken.slice(-8) : null
  };
}

/**
 * Check if current access token is expired or will expire within the buffer time
 * @param {number} bufferMinutes - Minutes before expiration to consider token expired (default: 5)
 * @returns {boolean} True if token is expired or will expire soon
 */
function isTokenExpired(bufferMinutes = 5) {
  if (!tokenExpiresAt) return true;
  const now = Date.now();
  const bufferMs = bufferMinutes * 60 * 1000;
  return now >= (tokenExpiresAt - bufferMs);
}

/**
 * Sleep for a specified duration with jitter for retry backoff
 * @param {number} ms - Base milliseconds to sleep
 * @param {number} jitterPercent - Percentage of jitter to add (default: 10%)
 */
async function sleep(ms, jitterPercent = 10) {
  const jitter = Math.random() * (ms * jitterPercent / 100);
  const sleepTime = ms + jitter;
  await new Promise(resolve => setTimeout(resolve, sleepTime));
}

/**
 * Safely refresh Spreaker access token and update current refresh token state
 * This prevents the token burning issue by maintaining token state within the process
 * Includes proactive refresh, retry logic, and concurrency control
 */
async function safeRefreshAccessToken() {
  // If we have a valid access token that's not expired, return it
  if (currentAccessToken && !isTokenExpired()) {
    console.log('✅ Using existing valid access token');
    return currentAccessToken;
  }

  // Prevent concurrent refresh attempts
  if (refreshInProgress) {
    console.log('⏳ Token refresh already in progress, waiting...');
    // Wait for existing refresh to complete (up to 30 seconds)
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      if (!refreshInProgress) {
        if (currentAccessToken && !isTokenExpired()) {
          console.log('✅ Token refresh completed by another process');
          return currentAccessToken;
        }
        break;
      }
    }
    // If still in progress after 30s, proceed anyway to avoid deadlock
    if (refreshInProgress) {
      console.warn('⚠️ Token refresh taking too long, proceeding with new refresh attempt');
    }
  }

  refreshInProgress = true;
  console.log('🔑 Refreshing Spreaker access token using current refresh token...');
  
  if (!currentRefreshToken) {
    refreshInProgress = false;
    throw new Error('No refresh token available. Please check SPREAKER_REFRESH_TOKEN environment variable.');
  }
  
  const maxRetries = 3;
  const baseDelay = 1000; // Start with 1 second
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Token refresh attempt ${attempt}/${maxRetries}`);
      
      const tokenResult = await refreshAccessToken({ 
        client_id: process.env.SPREAKER_CLIENT_ID, 
        client_secret: process.env.SPREAKER_CLIENT_SECRET, 
        refresh_token: currentRefreshToken 
      });
      
      const accessToken = typeof tokenResult === 'string' ? tokenResult : tokenResult.access_token;
      const expiresInSeconds = tokenResult.expires_in || 3600; // Default to 1 hour if not provided
      
      // Update current token state
      currentAccessToken = accessToken;
      tokenExpiresAt = Date.now() + (expiresInSeconds * 1000);
      
      console.log(`✅ Access token refreshed successfully (expires in ${expiresInSeconds} seconds)`);
      console.log(`🕒 Token expires at: ${new Date(tokenExpiresAt).toISOString()}`);
      
      // Critical: If Spreaker provided a new refresh token, update our current state immediately
      if (tokenResult.refresh_token && tokenResult.refresh_token !== currentRefreshToken) {
        console.log('🔄 New refresh token received from Spreaker. Updating current token state...');
        
        // Update the current process state FIRST
        const oldToken = currentRefreshToken;
        currentRefreshToken = tokenResult.refresh_token;
        
        console.log(`🔑 Refresh token updated in process: ${oldToken.slice(-8)} -> ${currentRefreshToken.slice(-8)}`);
        
        // Then attempt to update Railway environment variable for future runs
        const railwayApiToken = process.env.RAILWAY_API_TOKEN;
        const projectId = process.env.RAILWAY_PROJECT_ID;
        const environmentId = process.env.RAILWAY_ENVIRONMENT_ID || 'production';
        
        if (railwayApiToken && projectId) {
          try {
            const { updateSpeakerRefreshToken } = await import('../utils/railway-env-updater.js');
            await updateSpeakerRefreshToken({
              apiToken: railwayApiToken,
              projectId: projectId,
              environmentId: environmentId,
              refreshToken: currentRefreshToken
            });
            console.log('✅ Successfully updated SPREAKER_REFRESH_TOKEN in Railway environment');
          } catch (updateError) {
            console.error('⚠️  Failed to automatically update Railway environment variable:', updateError.message);
            console.error('   Current process will continue with new token, but please manually update SPREAKER_REFRESH_TOKEN to:', currentRefreshToken);
          }
        } else {
          console.log('⚠️  Cannot auto-update Railway environment variable (missing RAILWAY_API_TOKEN or RAILWAY_PROJECT_ID)');
          console.log('   Current process will continue with new token, but please manually update SPREAKER_REFRESH_TOKEN to:', currentRefreshToken);
        }
      }
      
      refreshInProgress = false;
      return accessToken;
      
    } catch (error) {
      console.error(`❌ Token refresh attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      // Check if this is an invalid_grant error that won't be resolved by retrying
      if (error.message.includes('invalid_grant') || error.message.includes('Invalid refresh token')) {
        console.error('');
        console.error('🚨 CRITICAL: Invalid refresh token detected - retries will not help.');
        console.error('   The refresh token stored in Railway environment variables is expired or invalid.');
        console.error('   This requires manual intervention:');
        console.error('   1. Use the oauth-server.js helper to get a new token, or');
        console.error('   2. Manually regenerate from your Spreaker app settings');
        console.error(`   Current token (last 8 chars): ${currentRefreshToken ? currentRefreshToken.slice(-8) : 'undefined'}`);
        console.error('');
        refreshInProgress = false;
        throw error; // Don't retry invalid_grant errors
      }
      
      // For other errors, implement exponential backoff if not the last attempt
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
        console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}...`);
        await sleep(delay, 20); // Add 20% jitter
      } else {
        // Last attempt failed
        console.error('');
        console.error('💥 All token refresh attempts failed. This indicates a persistent issue.');
        console.error('   Possible causes:');
        console.error('   1. Network connectivity issues with Spreaker API');
        console.error('   2. Spreaker service outage');
        console.error('   3. Invalid client credentials');
        console.error('   4. Rate limiting from Spreaker');
        console.error(`   Current refresh token (last 8 chars): ${currentRefreshToken ? currentRefreshToken.slice(-8) : 'undefined'}`);
        console.error('');
        refreshInProgress = false;
        throw error;
      }
    }
  }
}

/**
 * Upload episode with automatic token refresh on auth failure
 * This handles cases where access token expires during long-running processes
 * Now uses the improved token management with proactive refresh
 */
async function safeUploadEpisode(providedAccessToken, uploadParams) {
  // Use proactive token management - get a fresh token if needed
  let accessToken = providedAccessToken;
  
  // Check if we should proactively refresh the token
  if (!accessToken || isTokenExpired()) {
    console.log('🔄 Proactively refreshing access token before upload...');
    accessToken = await safeRefreshAccessToken();
  }
  
  try {
    // First attempt with current access token
    return await uploadEpisode({ accessToken: accessToken, ...uploadParams });
  } catch (error) {
    // Check if this is an authentication error that might be resolved with token refresh
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log('🔄 Upload failed with auth error, attempting to refresh access token and retry...');
      
      try {
        // Refresh the access token
        const newAccessToken = await safeRefreshAccessToken();
        
        // Retry the upload with fresh token
        console.log('🔁 Retrying upload with refreshed access token...');
        return await uploadEpisode({ accessToken: newAccessToken, ...uploadParams });
      } catch (refreshError) {
        console.error('❌ Failed to refresh token for retry:', refreshError.message);
        throw error; // Throw original upload error
      }
    } else {
      // Not an auth error, throw original error
      throw error;
    }
  }
}

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

/**
 * Initialize token management - ensures we have a valid access token at startup
 * This proactively gets a token to avoid delays during episode processing
 */
async function initializeTokens() {
  console.log('🚀 Initializing Spreaker token management...');
  
  if (!currentRefreshToken) {
    throw new Error('SPREAKER_REFRESH_TOKEN environment variable is not set.');
  }
  
  console.log(`🔑 Using refresh token (last 8 chars): ${currentRefreshToken.slice(-8)}`);
  
  // Get initial access token
  const accessToken = await safeRefreshAccessToken();
  console.log('✅ Token management initialized successfully');
  console.log('📊 Token status:', getTokenStatus());
  
  return accessToken;
}

async function main(){
  console.log('Starting weekly run...');
  console.log(`Environment: EPISODE_TIMEZONE=${TZ}, MAX_EPISODES=${MAX_EPISODES}, DRY_RUN=${DRY}`);
  if(!SPREADSHEET_ID||!TAB_NAME) throw new Error('Missing Google Sheet env vars.');
  if(!SHOW_ID) throw new Error('Missing SPREAKER_SHOW_ID.');
  
  // Initialize token management first
  await initializeTokens();
  
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
    if(!withinNextNDays(parseResult.date,180)) {
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
      // Use the token we already initialized, refresh if needed
      accessToken = await safeRefreshAccessToken();
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
        uploaded = await safeUploadEpisode(accessToken, {
          showId: SHOW_ID,
          filePath: audioPath,
          title: pkg.title,
          description: pkg.htmlDesc || pkg.description,
          tags: pkg.tags,
          autoPublishedAtUtc: autoUtc
        });
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
