import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { sendAdminEmail } from './sendAdminEmail.js';
import { getCurrentTimestamp, detectClockDrift, logTimestampedEvent } from './time-utils.js';
import { 
  checkBridgeHealth, 
  refreshTokenViaBridge, 
  isBridgeConfigured,
  getBridgeConfig
} from './bridge-client.js';

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

/**
 * Validate Spreaker OAuth app credentials (CLIENT_ID and CLIENT_SECRET)
 * This helps distinguish between credential issues vs token expiration issues
 * @param {string} client_id - Spreaker app client ID
 * @param {string} client_secret - Spreaker app client secret  
 * @returns {Promise<Object>} Validation result with success/error details
 */
async function validateSprekerCredentials(client_id, client_secret) {
  if (!client_id || !client_secret) {
    return {
      valid: false,
      reason: 'CLIENT_ID or CLIENT_SECRET is missing',
      suggestion: 'Check SPREAKER_CLIENT_ID and SPREAKER_CLIENT_SECRET environment variables'
    };
  }

  if (typeof client_id !== 'string' || typeof client_secret !== 'string') {
    return {
      valid: false,
      reason: 'CLIENT_ID or CLIENT_SECRET must be strings',
      suggestion: 'Verify the credential format in your environment variables'
    };
  }

  // Basic format validation - Spreaker client IDs are typically numeric
  if (!/^\d+$/.test(client_id.toString())) {
    return {
      valid: false,
      reason: 'CLIENT_ID should be numeric (typical Spreaker format)',
      suggestion: 'Verify your SPREAKER_CLIENT_ID matches the format from your Spreaker app settings'
    };
  }

  try {
    // Test credentials by attempting a token request with an obviously invalid refresh token
    // This will fail due to invalid refresh token but should return a proper OAuth error
    // If credentials are wrong, we'll get a different error (401 Unauthorized)
    const form = new FormData();
    form.append('grant_type', 'refresh_token');
    form.append('client_id', client_id);
    form.append('client_secret', client_secret);
    form.append('refresh_token', 'invalid_test_token_for_credential_validation');

    const response = await axios.post(`${BASE}/oauth2/token`, form, {
      headers: {
        ...form.getHeaders()
      },
      timeout: 15000 // 15 second timeout for OAuth requests
    });

    // This should not happen with our invalid test token
    return {
      valid: false,
      reason: 'Unexpected success with invalid test token',
      suggestion: 'This indicates a problem with the credential validation test'
    };

  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      // 400 with invalid_grant = credentials are valid, just the refresh token is invalid (expected)
      if (status === 400 && errorData?.error === 'invalid_grant') {
        return {
          valid: true,
          reason: 'Credentials are valid (got expected invalid_grant error)',
          suggestion: null
        };
      }
      
      // 401 Unauthorized = invalid client credentials
      if (status === 401) {
        return {
          valid: false,
          reason: 'Invalid client credentials (401 Unauthorized)',
          suggestion: 'Verify SPREAKER_CLIENT_ID and SPREAKER_CLIENT_SECRET in your Spreaker app settings'
        };
      }

      // 400 with invalid_client = invalid client credentials  
      if (status === 400 && errorData?.error === 'invalid_client') {
        return {
          valid: false,
          reason: 'Invalid client credentials (invalid_client error)',
          suggestion: 'Check your SPREAKER_CLIENT_ID and SPREAKER_CLIENT_SECRET values'
        };
      }

      // Other 400 errors might indicate other credential format issues
      if (status === 400) {
        return {
          valid: false,
          reason: `OAuth error: ${errorData?.error || 'unknown'} - ${errorData?.error_description || 'no description'}`,
          suggestion: 'Review your Spreaker app configuration and credentials'
        };
      }

      // Unexpected HTTP status
      return {
        valid: false,
        reason: `Unexpected HTTP ${status} response during credential validation`,
        suggestion: 'This may indicate an issue with the Spreaker API or network connectivity'
      };
    }

    // Network or other error
    return {
      valid: false,
      reason: `Network error during credential validation: ${error.message}`,
      suggestion: 'Check network connectivity and Spreaker API availability'
    };
  }
}

export { validateRefreshToken, validateSprekerCredentials };

export async function refreshAccessToken({ client_id, client_secret, refresh_token }) {
  const startTime = getCurrentTimestamp();
  const url = `${BASE}/oauth2/token`;
  
  logTimestampedEvent('Token refresh started', {
    endpoint: url,
    refresh_token_suffix: refresh_token ? refresh_token.slice(-8) : 'undefined',
    client_id: client_id
  });
  
  // Check for system clock drift before making OAuth request
  const clockDrift = detectClockDrift(2);
  if (clockDrift.hasDrift) {
    console.warn(`⏰ Clock drift detected before token refresh: ${clockDrift.driftSeconds.toFixed(2)}s`);
  }
  
  // Validate the refresh token before making the API call
  const validation = validateRefreshToken(refresh_token);
  if (!validation.valid) {
    const errorMsg = `Invalid refresh token: ${validation.reason}`;
    logTimestampedEvent('Token refresh validation failed', { 
      reason: validation.reason,
      error: errorMsg 
    });
    console.error('❌ Invalid refresh token detected before API call:', validation.reason);
    console.error('🔧 Please check your SPREAKER_REFRESH_TOKEN environment variable');
    throw new Error(errorMsg);
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
    const requestTime = getCurrentTimestamp();
    logTimestampedEvent('Sending OAuth token request', { request_time: requestTime });
    
    const res = await axios.post(url, form, {
      headers: {
        ...form.getHeaders()
      },
      timeout: 15000 // 15 second timeout for OAuth requests
    });
    
    const responseTime = getCurrentTimestamp();
    const successMsg = 'Successfully refreshed Spreaker access token';
    
    logTimestampedEvent('Token refresh completed successfully', {
      access_token_present: !!res.data.access_token,
      expires_in: res.data.expires_in,
      new_refresh_token_present: !!res.data.refresh_token,
      new_refresh_token_suffix: res.data.refresh_token ? res.data.refresh_token.slice(-8) : null,
      response_time: responseTime,
      request_duration_ms: new Date(responseTime) - new Date(requestTime)
    });
    
    console.log('✅', successMsg);
    console.log(`🕒 Access token expires in ${res.data.expires_in || 'unknown'} seconds`);
    
    // Return both access token and any new refresh token provided
    const result = { 
      access_token: res.data.access_token,
      expires_in: res.data.expires_in, // Include expiration time for proactive management
      issued_at: getCurrentTimestamp() // Add timestamp for better tracking
    };
    
    // Critical: If Spreaker provides a new refresh token, include it in the response
    // This ensures one-time-use token rotation is properly handled
    if (res.data.refresh_token) {
      result.refresh_token = res.data.refresh_token;
      
      // Log token rotation with masked data
      logTimestampedEvent('New refresh token received - token rotation required', {
        old_token_suffix: refresh_token ? refresh_token.slice(-8) : null,
        new_token_suffix: res.data.refresh_token.slice(-8),
        token_changed: res.data.refresh_token !== refresh_token,
        rotation_timestamp: getCurrentTimestamp()
      });
      
      console.log(`🔄 New refresh token received: ${res.data.refresh_token.slice(-8)}`);
      console.log('⚠️  Update SPREAKER_REFRESH_TOKEN environment variable to:', res.data.refresh_token);
    } else {
      logTimestampedEvent('No new refresh token provided - current token remains valid', {
        current_token_suffix: refresh_token ? refresh_token.slice(-8) : null
      });
      console.log('✅ No new refresh token provided - current token remains valid');
    }
    
    return result;
  } catch (error) {
    const errorTime = getCurrentTimestamp();
    logTimestampedEvent('Direct token refresh failed', {
      error_type: error.constructor.name,
      has_response: !!error.response,
      error_message: error.message,
      error_time: errorTime,
      request_duration_ms: new Date(errorTime) - new Date(startTime),
      will_try_bridge: isBridgeConfigured()
    });
    
    console.error('❌ Direct Spreaker token refresh failed:', error.message);
    
    // Try bridge service as fallback if configured
    if (isBridgeConfigured()) {
      console.log('🌉 Attempting token refresh via bridge service fallback...');
      
      try {
        // Check bridge health first
        const bridgeHealth = await checkBridgeHealth();
        if (!bridgeHealth.healthy) {
          console.warn('⚠️ Bridge service is not healthy, skipping bridge fallback');
          throw new Error(`Bridge service unhealthy: ${bridgeHealth.error || 'unknown'}`);
        }
        
        logTimestampedEvent('Bridge fallback initiated', {
          bridge_health: bridgeHealth.healthy,
          direct_error: error.message
        });
        
        const bridgeResult = await refreshTokenViaBridge(true); // Force refresh
        
        logTimestampedEvent('Bridge fallback successful', {
          cached: bridgeResult.cached,
          expires_in_seconds: bridgeResult.expires_in,
          rotation_count: bridgeResult.rotation_count
        });
        
        console.log('✅ Token refresh successful via bridge service');
        console.log(`🕒 Access token expires in ${bridgeResult.expires_in || 'unknown'} seconds`);
        
        // Return bridge result in same format as direct refresh
        return {
          access_token: bridgeResult.access_token,
          expires_in: bridgeResult.expires_in,
          refresh_token: bridgeResult.refresh_token,
          issued_at: getCurrentTimestamp(),
          source: 'bridge' // Mark as bridge-sourced for logging
        };
        
      } catch (bridgeError) {
        logTimestampedEvent('Bridge fallback failed', {
          bridge_error: bridgeError.message,
          original_error: error.message
        });
        
        console.error('❌ Bridge service fallback also failed:', bridgeError.message);
        console.error('🔧 Both direct and bridge token refresh failed - manual intervention required');
        
        // Continue with original error handling since bridge failed too
      }
    } else {
      console.log('🚫 Bridge service not configured - skipping fallback');
      console.log('💡 Configure TOKEN_BRIDGE_URL and BRIDGE_SECRET to enable bridge fallback');
    }
    
    // Enhanced debugging information with timestamps
    console.error('Error details:', {
      errorType: error.constructor.name,
      hasResponse: !!error.response,
      timestamp: errorTime,
      requestStartTime: startTime,
      bridgeConfigured: isBridgeConfigured()
    });
    
    if (error.response) {
      const responseError = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      };
      
      logTimestampedEvent('OAuth API error response', responseError);
      console.error('OAuth Error Response:', responseError);
      
      // Enhanced error analysis
      if (error.response.headers) {
        console.error('Response headers (for debugging):', {
          'content-type': error.response.headers['content-type'],
          'x-ratelimit-remaining': error.response.headers['x-ratelimit-remaining'],
          'x-ratelimit-reset': error.response.headers['x-ratelimit-reset']
        });
      }
      
      // Automated notification for invalid_grant - but first check if it's a credential issue
      if (error.response.status === 400 && error.response.data?.error === 'invalid_grant') {
        console.error('');
        console.error('🔧 ACTION REQUIRED: The Spreaker refresh token has expired or is invalid.');
        console.error('');
        console.error('🔍 Checking if this is a credential issue vs token expiration...');
        
        try {
          const credentialValidation = await validateSprekerCredentials(client_id, client_secret);
          if (!credentialValidation.valid) {
            console.error('🚨 CREDENTIAL ISSUE DETECTED:');
            console.error(`   Problem: ${credentialValidation.reason}`);
            console.error(`   Solution: ${credentialValidation.suggestion}`);
            console.error('');
            console.error('🔧 IMMEDIATE ACTIONS REQUIRED:');
            console.error('   1. Verify your SPREAKER_CLIENT_ID and SPREAKER_CLIENT_SECRET in Railway');
            console.error('   2. Check your Spreaker app configuration at https://www.spreaker.com/apps');
            console.error('   3. Ensure the app permissions and redirect URI are configured correctly');
            console.error('   4. After fixing credentials, generate a new refresh token using oauth-server.js');
          } else {
            console.error('✅ Credentials appear valid - this is likely a token expiration issue.');
            console.error('');
            console.error('🔧 TOKEN REFRESH REQUIRED:');
            console.error('   1. The refresh token has expired and needs to be regenerated');
            console.error('   2. Use oauth-server.js helper to get a new token');  
            console.error('   3. Update SPREAKER_REFRESH_TOKEN environment variable in Railway');
          }
        } catch (validationError) {
          console.error('⚠️  Could not validate credentials due to:', validationError.message);
          console.error('   Proceeding with standard token refresh guidance...');
        }
        
        // Send email notification to admin
        await sendAdminEmail({
          to: 'nick@tryconvenient.com',
          subject: 'Spreaker Refresh Token Expired',
          text: `The Spreaker refresh token has expired or is invalid.\n\nPlease re-authenticate using the following link: https://yourdomain.com/spreaker/re-auth\n\nCurrent token (last 8 chars): ${refresh_token ? refresh_token.slice(-8) : 'undefined'}\n\nThis typically happens when:\n1. The token has expired (refresh tokens do expire after some time)\n2. The token was already used and burned in a previous failed run\n3. The token was manually regenerated in Spreaker app settings.`
        });
        console.error('Automated email sent to admin for re-authentication.');
      }

      // Check for credential-specific errors
      if (error.response.status === 401 || 
          (error.response.status === 400 && error.response.data?.error === 'invalid_client')) {
        console.error('');
        console.error('🚨 CREDENTIAL ERROR: Invalid Spreaker app credentials detected');
        console.error('   This indicates your SPREAKER_CLIENT_ID or SPREAKER_CLIENT_SECRET is incorrect');
        console.error('');
        console.error('🔧 IMMEDIATE ACTIONS REQUIRED:');
        console.error('   1. Go to https://www.spreaker.com/apps and verify your app credentials');
        console.error('   2. Update SPREAKER_CLIENT_ID and SPREAKER_CLIENT_SECRET in Railway');
        console.error('   3. Ensure your app has the correct permissions and redirect URI');
        console.error('   4. After fixing credentials, generate a new refresh token');
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
    maxBodyLength: Infinity,
    timeout: 60000 // 60 second timeout for file uploads (longer due to file size)
  });

  const episodeId = res.data?.response?.episode?.episode_id || res.data?.response?.items?.[0]?.episode_id;

  return { episodeId, raw: res.data };
}
