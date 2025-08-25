import fs from 'fs';
import fetch from 'node-fetch';
import { splitForTTS } from './utils.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync=promisify(execFile);
const OPENAI_API_KEY=process.env.OPENAI_API_KEY;
async function ttsChunk(text,outPath,voice='fable',format='mp3'){
  const res=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{'Authorization':`Bearer ${OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini-tts',input:text,voice,format})});
  if(!res.ok){throw new Error(`OpenAI TTS error ${res.status}: ${await res.text()}`);} 
  const buf=Buffer.from(await res.arrayBuffer()); fs.writeFileSync(outPath,buf);
}
export async function synthesizeToMp3(fullText,outFile,voice='fable'){
  const parts=splitForTTS(fullText,3500); const segPaths=[];
  for(let i=0;i<parts.length;i++){const seg=parts[i]; const p=`${outFile}.seg${String(i+1).padStart(2,'0')}.mp3`; await ttsChunk(seg,p,voice,'mp3'); segPaths.push(p);}
  if(segPaths.length===1){fs.renameSync(segPaths[0],outFile); return outFile;}
  const listPath=`${outFile}.concat.txt`; fs.writeFileSync(listPath,segPaths.map(p=>`file '${p.replace("'","'\''")}'`).join('\n'));
  await execFileAsync('ffmpeg',['-y','-f','concat','-safe','0','-i',listPath,'-c','copy',outFile]);
  segPaths.forEach(p=>{try{fs.unlinkSync(p);}catch{}}); try{fs.unlinkSync(listPath);}catch{}; return outFile;
}