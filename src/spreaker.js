import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { sendAdminEmail } from './sendAdminEmail.js';

const BASE = 'https://api.spreaker.com';

/**
 * Basic validation for Spreaker refresh token format
 * This catches obviously invalid tokens before making API calls
 */
function validateRefreshToken(token) {
  if (!token) {
    return { valid: false, reason: 'Token is empty or undefined' };
  }
  
  if (typeof token !== 'string') {
    return { valid: false, reason: 'Token must be a string' };
  }
  
  if (token.length < 20) {
    return { valid: false, reason: 'Token appears too short (less than 20 characters)' };
  }
  
  // Check for common placeholder values that indicate the token hasn't been set properly
  const placeholders = ['your_token_here', 'placeholder', 'change_me', 'example'];
  if (placeholders.some(placeholder => token.toLowerCase().includes(placeholder))) {
    return { valid: false, reason: 'Token appears to be a placeholder value' };
  }
  
  return { valid: true };
}

export { validateRefreshToken };

export async function refreshAccessToken({ client_id, client_secret, refresh_token }) {
  const url = `${BASE}/oauth2/token`;
  
  console.log('Refreshing Spreaker access token...');
  console.log(`Using refresh token (last 8 chars): ${refresh_token ? refresh_token.slice(-8) : 'undefined'}`);
  
  // Validate the refresh token before making the API call
  const validation = validateRefreshToken(refresh_token);
  if (!validation.valid) {
    console.error('❌ Invalid refresh token detected before API call:', validation.reason);
    console.error('🔧 Please check your SPREAKER_REFRESH_TOKEN environment variable');
    throw new Error(`Invalid refresh token: ${validation.reason}`);
  }
  
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
      access_token: res.data.access_token,
      expires_in: res.data.expires_in // Include expiration time for proactive management
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
    
    // Enhanced debugging information
    console.error('Error details:', {
      errorType: error.constructor.name,
      hasResponse: !!error.response,
      timestamp: new Date().toISOString()
    });
    
    if (error.response) {
      console.error('OAuth Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      // Enhanced error analysis
      if (error.response.headers) {
        console.error('Response headers (for debugging):', {
          'content-type': error.response.headers['content-type'],
          'x-ratelimit-remaining': error.response.headers['x-ratelimit-remaining'],
          'x-ratelimit-reset': error.response.headers['x-ratelimit-reset']
        });
      }
      
      // Automated notification for invalid_grant
      if (error.response.status === 400 && error.response.data?.error === 'invalid_grant') {
        console.error('');
        console.error('🔧 ACTION REQUIRED: The Spreaker refresh token has expired or is invalid.');
        // Send email notification to admin
        await sendAdminEmail({
          to: 'nick@tryconvenient.com',
          subject: 'Spreaker Refresh Token Expired',
          text: `The Spreaker refresh token has expired or is invalid.\n\nPlease re-authenticate using the following link: https://yourdomain.com/spreaker/re-auth\n\nCurrent token (last 8 chars): ${refresh_token ? refresh_token.slice(-8) : 'undefined'}\n\nThis typically happens when:\n1. The token has expired (refresh tokens do expire after some time)\n2. The token was already used and burned in a previous failed run\n3. The token was manually regenerated in Spreaker app settings.`
        });
        console.error('Automated email sent to admin for re-authentication.');
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
