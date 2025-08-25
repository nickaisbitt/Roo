import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
const BASE='https://api.spreaker.com';
export async function refreshAccessToken({client_id,client_secret,refresh_token}){
  const url=`${BASE}/oauth2/token`; const form=new FormData(); form.append('grant_type','refresh_token'); form.append('client_id',client_id); form.append('client_secret',client_secret); form.append('refresh_token',refresh_token);
  const res=await axios.post(url,form,{headers:form.getHeaders()}); return res.data.access_token;
}
export async function uploadEpisode({accessToken,showId,filePath,title,description,tags,autoPublishedAtUtc=null,explicit=false,downloadEnabled=true,hidden=false}){
  const url=`${BASE}/v2/shows/${showId}/episodes`; const form=new FormData();
  form.append('media_file',fs.createReadStream(filePath)); form.append('title',title);
  if(description) form.append('description',description); if(tags) form.append('tags',tags);
  form.append('explicit',explicit?'true':'false'); form.append('download_enabled',downloadEnabled?'true':'false'); form.append('hidden',hidden?'true':'false');
  if(autoPublishedAtUtc) form.append('auto_published_at',autoPublishedAtUtc);
  const res=await axios.post(url,form,{headers:{Authorization:`Bearer ${accessToken}`,...form.getHeaders()},maxBodyLength:Infinity});
  const episodeId=res.data?.response?.episode?.episode_id || res.data?.response?.items?.[0]?.episode_id;
  return { episodeId, raw: res.data };
}