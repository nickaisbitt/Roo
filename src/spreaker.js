import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const BASE = 'https://api.spreaker.com';

export async function refreshAccessToken({ client_id, client_secret, refresh_token }) {
  const url = `${BASE}/oauth2/token`;
  
  console.log('Refreshing Spreaker access token...');
  console.log(`Using refresh token (last 8 chars): ${refresh_token ? refresh_token.slice(-8) : 'undefined'}`);
  
  // Create a fresh FormData instance for each request
  const form = new FormData();
  
  form.append('grant_type', 'refresh_token');
  form.append('client_id', client_id);
  form.append('client_secret', client_secret);
  form.append('refresh_token', refresh_token);

  // Check if form is destroyed before sending
  if (form.destroyed) {
    console.error('Warning: FormData instance is destroyed before axios.post');
  }

  try {
    const res = await axios.post(url, form, {
      headers: {
        ...form.getHeaders()
      }
    });
    
    console.log('Successfully refreshed Spreaker access token');
    console.log(`Access token received (expires in ${res.data.expires_in || 'unknown'} seconds)`);
    
    // Return both access token and any new refresh token provided
    const result = { 
      access_token: res.data.access_token 
    };
    
    // If Spreaker provides a new refresh token, include it in the response
    if (res.data.refresh_token) {
      result.refresh_token = res.data.refresh_token;
      console.log(`⚠️  New refresh token received: ${res.data.refresh_token.slice(-8)}`);
      console.log('⚠️  Update SPREAKER_REFRESH_TOKEN environment variable to:', res.data.refresh_token);
    } else {
      console.log('✅ No new refresh token provided - current token remains valid');
    }
    
    return result;
  } catch (error) {
    console.error('Failed to refresh Spreaker access token:', error.message);
    if (error.response) {
      console.error('OAuth Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      // Provide helpful guidance for common OAuth errors
      if (error.response.status === 400 && error.response.data?.error === 'invalid_grant') {
        console.error('');
        console.error('🔧 ACTION REQUIRED: The Spreaker refresh token has expired or is invalid.');
        console.error('   Please regenerate a new refresh token from your Spreaker app settings');
        console.error('   and update the SPREAKER_REFRESH_TOKEN environment variable.');
        console.error('');
      }
    }
    throw new Error(`OAuth token refresh failed: ${error.message}`);
  }
}

export async function uploadEpisode({
  accessToken,
  showId,
  filePath,
  title,
  description,
  tags,
  autoPublishedAtUtc = null,
  explicit = false,
  downloadEnabled = true,
  hidden = false
}) {
  const url = `${BASE}/v2/shows/${showId}/episodes`;
  
  // Create a fresh FormData instance for each request
  const form = new FormData();
  
  // Create a fresh readable stream for file upload
  const fileStream = fs.createReadStream(filePath);
  
  // Runtime check for stream and form state before sending
  if (fileStream.destroyed) {
    console.error('Warning: File stream is destroyed before axios.post');
  }
  
  if (form.destroyed) {
    console.error('Warning: FormData instance is destroyed before axios.post');
  }
  
  form.append('media_file', fileStream);
  form.append('title', title);

  if (description) form.append('description', description);
  if (tags) form.append('tags', tags);

  form.append('explicit', explicit ? 'true' : 'false');
  form.append('download_enabled', downloadEnabled ? 'true' : 'false');
  form.append('hidden', hidden ? 'true' : 'false');

  if (autoPublishedAtUtc) form.append('auto_published_at', autoPublishedAtUtc);

  const res = await axios.post(url, form, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...form.getHeaders()
    },
    maxBodyLength: Infinity
  });

  const episodeId = res.data?.response?.episode?.episode_id || res.data?.response?.items?.[0]?.episode_id;

  return { episodeId, raw: res.data };
}
