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
import { refreshAccessToken, uploadEpisode, validateRefreshToken, validateSprekerCredentials } from './spreaker.js';
import { getCurrentTimestamp, detectClockDrift, logTimestampedEvent, validateTimestamp } from './time-utils.js';

// Global counters for tracking OAuth operations with enhanced time-based metrics
let oauthOperationCount = {
  refreshAttempts: 0,
  refreshSuccesses: 0,
  refreshFailures: 0,
  uploadRetries: 0,
  proactiveChecks: 0,
  railwayUpdates: 0,
  startupValidations: 0,
  tokenRotations: 0,
  clockDriftDetections: 0,
  lastResetTime: getCurrentTimestamp()
};

/**
 * Log OAuth operation statistics for debugging recurring issues with enhanced time tracking
 */
function logOAuthStats(context = '') {
  const currentTime = getCurrentTimestamp();
  const timeSinceReset = new Date(currentTime) - new Date(oauthOperationCount.lastResetTime);
  const uptimeMinutes = (timeSinceReset / (1000 * 60)).toFixed(1);
  
  logTimestampedEvent(`OAuth Operations Stats${context ? ` (${context})` : ''}`, {
    refresh_attempts: oauthOperationCount.refreshAttempts,
    refresh_successes: oauthOperationCount.refreshSuccesses,
    refresh_failures: oauthOperationCount.refreshFailures,
    upload_retries: oauthOperationCount.uploadRetries,
    proactive_checks: oauthOperationCount.proactiveChecks,
    railway_updates: oauthOperationCount.railwayUpdates,
    startup_validations: oauthOperationCount.startupValidations,
    token_rotations: oauthOperationCount.tokenRotations,
    clock_drift_detections: oauthOperationCount.clockDriftDetections,
    success_rate: oauthOperationCount.refreshAttempts > 0 
      ? ((oauthOperationCount.refreshSuccesses / oauthOperationCount.refreshAttempts) * 100).toFixed(1) 
      : 'N/A',
    uptime_minutes: uptimeMinutes
  });
  
  console.log(`📊 OAuth Operations Stats${context ? ` (${context})` : ''}:`);
  console.log(`   - Token refresh attempts: ${oauthOperationCount.refreshAttempts}`);
  console.log(`   - Token refresh successes: ${oauthOperationCount.refreshSuccesses}`);
  console.log(`   - Token refresh failures: ${oauthOperationCount.refreshFailures}`);
  console.log(`   - Upload retries due to auth: ${oauthOperationCount.uploadRetries}`);
  console.log(`   - Proactive health checks: ${oauthOperationCount.proactiveChecks}`);
  console.log(`   - Railway env updates: ${oauthOperationCount.railwayUpdates}`);
  console.log(`   - Startup validations: ${oauthOperationCount.startupValidations}`);
  console.log(`   - Token rotations: ${oauthOperationCount.tokenRotations}`);
  console.log(`   - Clock drift detections: ${oauthOperationCount.clockDriftDetections}`);
  console.log(`   - Success rate: ${oauthOperationCount.refreshAttempts > 0 ? ((oauthOperationCount.refreshSuccesses / oauthOperationCount.refreshAttempts) * 100).toFixed(1) : 'N/A'}%`);
  console.log(`   - Uptime: ${uptimeMinutes} minutes`);
}

const SPREADSHEET_ID=process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const TAB_NAME=process.env.GOOGLE_SHEETS_TAB_NAME;
const SHOW_ID=process.env.SPREAKER_SHOW_ID;
const MAX_EPISODES=parseInt(process.env.MAX_EPISODES_PER_RUN||'2',10);
const DRY=coerceBoolean(process.env.DRY_RUN||'false');
const TZ=process.env.EPISODE_TIMEZONE||'UTC';
const PUBLISH_TIME=process.env.SPREAKER_PUBLISH_TIME_UTC||'08:00:00';

// Token state management - maintains current refresh token during process execution
// Enhanced with atomic updates and better tracking
let currentRefreshToken = process.env.SPREAKER_REFRESH_TOKEN;
let currentAccessToken = null;
let tokenExpiresAt = null;
let refreshInProgress = false;
let tokenIssuedAt = null; // Track when token was issued for better lifecycle management

/**
 * Get current token status for debugging and monitoring with enhanced metadata
 * @returns {Object} Token status information with timestamps and drift detection
 */
function getTokenStatus() {
  const clockDrift = detectClockDrift(2);
  if (clockDrift.hasDrift) {
    oauthOperationCount.clockDriftDetections++;
  }
  
  return {
    timestamp: getCurrentTimestamp(),
    hasRefreshToken: !!currentRefreshToken,
    hasAccessToken: !!currentAccessToken,
    isExpired: isTokenExpired(),
    expiresAt: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null,
    issuedAt: tokenIssuedAt ? new Date(tokenIssuedAt).toISOString() : null,
    refreshInProgress: refreshInProgress,
    refreshTokenLastChars: currentRefreshToken ? currentRefreshToken.slice(-8) : null,
    clockDrift: clockDrift.hasDrift ? {
      detected: true,
      driftSeconds: clockDrift.driftSeconds,
      warning: clockDrift.warning
    } : { detected: false },
    tokenAge: tokenIssuedAt ? Math.floor((Date.now() - tokenIssuedAt) / 1000) : null
  };
}

/**
 * Atomic token update function to prevent race conditions and ensure one-time-use
 * This is the single point of truth for updating token state
 * @param {string} newAccessToken - New access token
 * @param {number} expiresIn - Token expiration time in seconds
 * @param {string} newRefreshToken - New refresh token (optional)
 * @param {string} issuedAtTimestamp - When token was issued (optional)
 */
function atomicTokenUpdate(newAccessToken, expiresIn, newRefreshToken = null, issuedAtTimestamp = null) {
  const updateTime = getCurrentTimestamp();
  const oldRefreshToken = currentRefreshToken;
  const oldAccessToken = currentAccessToken;
  
  logTimestampedEvent('Atomic token update started', {
    old_access_token_present: !!oldAccessToken,
    old_refresh_token_suffix: oldRefreshToken ? oldRefreshToken.slice(-8) : null,
    new_access_token_present: !!newAccessToken,
    new_refresh_token_present: !!newRefreshToken,
    new_refresh_token_suffix: newRefreshToken ? newRefreshToken.slice(-8) : null,
    expires_in: expiresIn,
    update_time: updateTime
  });

  // Update access token and expiration
  if (newAccessToken) {
    currentAccessToken = newAccessToken;
    tokenExpiresAt = Date.now() + (expiresIn * 1000);
    tokenIssuedAt = issuedAtTimestamp ? new Date(issuedAtTimestamp).getTime() : Date.now();
  }

  // Critical: Update refresh token if provided (one-time-use enforcement)
  if (newRefreshToken && newRefreshToken !== currentRefreshToken) {
    console.log(`🔄 Token rotation: ${oldRefreshToken?.slice(-8) || 'none'} → ${newRefreshToken.slice(-8)}`);
    currentRefreshToken = newRefreshToken;
    oauthOperationCount.tokenRotations++;
    
    logTimestampedEvent('Refresh token rotated - old token invalidated', {
      old_token_invalidated: !!oldRefreshToken,
      new_token_active: true,
      rotation_count: oauthOperationCount.tokenRotations
    });
    
    // Explicitly null out old token reference to ensure it's not reused
    const discardedToken = oldRefreshToken;
    console.log(`🚮 Old refresh token discarded: ${discardedToken?.slice(-8) || 'none'} (will never be reused)`);
  }

  logTimestampedEvent('Atomic token update completed', {
    access_token_updated: !!newAccessToken,
    refresh_token_rotated: !!(newRefreshToken && newRefreshToken !== oldRefreshToken),
    expires_at: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null,
    complete_time: getCurrentTimestamp()
  });
}

/**
 * Check if current access token is expired or will expire within the buffer time
 * Enhanced with timestamp validation and drift detection
 * @param {number} bufferMinutes - Minutes before expiration to consider token expired (default: 5)
 * @returns {boolean} True if token is expired or will expire soon
 */
function isTokenExpired(bufferMinutes = 5) {
  if (!tokenExpiresAt) return true;
  
  const now = Date.now();
  const bufferMs = bufferMinutes * 60 * 1000;
  const isExpired = now >= (tokenExpiresAt - bufferMs);
  
  // Validate expiration time against system clock
  if (tokenExpiresAt) {
    const validation = validateTimestamp(new Date(tokenExpiresAt).toISOString(), 7200); // 2 hours max age
    if (!validation.valid && validation.clockDrift) {
      console.warn('⚠️  Token expiration timestamp indicates system clock drift');
      oauthOperationCount.clockDriftDetections++;
    }
  }
  
  return isExpired;
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
 * Validate refresh token at startup to catch expired tokens early
 * This prevents deployment failures by failing fast with clear instructions
 */
async function validateTokenAtStartup() {
  console.log('🔍 Validating refresh token at startup...');
  oauthOperationCount.startupValidations++;
  
  if (!currentRefreshToken) {
    throw new Error('No SPREAKER_REFRESH_TOKEN environment variable found. Please set this before deployment.');
  }

  // First validate credentials before attempting token refresh
  console.log('🔐 Validating Spreaker app credentials...');
  try {
    const credentialValidation = await validateSprekerCredentials(
      process.env.SPREAKER_CLIENT_ID, 
      process.env.SPREAKER_CLIENT_SECRET
    );
    
    if (!credentialValidation.valid) {
      console.error('❌ Spreaker credential validation failed:', credentialValidation.reason);
      console.error('💡 Suggestion:', credentialValidation.suggestion);
      console.error('');
      console.error('🔧 CREDENTIAL ISSUE - Fix before proceeding:');
      console.error('   1. Verify SPREAKER_CLIENT_ID and SPREAKER_CLIENT_SECRET in Railway');
      console.error('   2. Check your Spreaker app settings at https://www.spreaker.com/apps');
      console.error('   3. Ensure redirect URI matches your Railway deployment URL');
      throw new Error(`Invalid Spreaker credentials: ${credentialValidation.reason}`);
    }
    
    console.log('✅ Spreaker app credentials are valid');
  } catch (credentialError) {
    // If credential validation fails due to network issues, log but continue
    if (credentialError.message.includes('Network error') || credentialError.message.includes('connectivity')) {
      console.warn('⚠️  Could not validate credentials due to network issues, proceeding with token test...');
    } else {
      throw credentialError; // Re-throw credential validation errors
    }
  }

  // Basic validation
  const validation = validateRefreshToken(currentRefreshToken);
  if (!validation.valid) {
    throw new Error(`Invalid SPREAKER_REFRESH_TOKEN: ${validation.reason}. Please regenerate the token.`);
  }

  // Test the token by making a refresh call
  try {
    console.log('🔑 Testing refresh token validity with Spreaker API...');
    oauthOperationCount.refreshAttempts++;
    
    const tokenResult = await refreshAccessToken({ 
      client_id: process.env.SPREAKER_CLIENT_ID, 
      client_secret: process.env.SPREAKER_CLIENT_SECRET, 
      refresh_token: currentRefreshToken 
    });
    
    oauthOperationCount.refreshSuccesses++;
    console.log('✅ Refresh token is valid and working');
    
    // Update current token if a new one was provided
    if (tokenResult.refresh_token && tokenResult.refresh_token !== currentRefreshToken) {
      console.log('🔄 New refresh token received during startup validation. Updating...');
      const oldToken = currentRefreshToken;
      currentRefreshToken = tokenResult.refresh_token;
      console.log(`🔑 Token updated during startup: ${oldToken.slice(-8)} -> ${currentRefreshToken.slice(-8)}`);
      
      // Try to update Railway environment
      await updateRailwayEnvironment(currentRefreshToken, 'startup validation');
    }
    
    return typeof tokenResult === 'string' ? tokenResult : tokenResult.access_token;
  } catch (error) {
    oauthOperationCount.refreshFailures++;
    console.error('❌ Startup token validation failed:', error.message);
    
    if (error.message.includes('invalid_grant') || error.message.includes('Invalid refresh token')) {
      console.error('');
      console.error('🚨 CRITICAL: The SPREAKER_REFRESH_TOKEN has expired or is invalid.');
      console.error('   This will cause deployment failures. Action required:');
      console.error('   1. Generate a new refresh token using oauth-server.js or Spreaker app settings');
      console.error('   2. Update the SPREAKER_REFRESH_TOKEN environment variable in Railway');
      console.error('   3. Redeploy the service');
      console.error('');
      console.error('   Current token (last 8 chars):', currentRefreshToken ? currentRefreshToken.slice(-8) : 'undefined');
    }
    
    // Log current stats for debugging
    logOAuthStats('startup validation failure');
    
    throw new Error(`Startup token validation failed: ${error.message}. Please fix the refresh token before deployment.`);
  }
}

/**
 * Update Railway environment variable with retry logic
 */
async function updateRailwayEnvironment(newRefreshToken, context = 'token refresh') {
  const railwayApiToken = process.env.RAILWAY_API_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID || 'production';
  
  if (!railwayApiToken || !projectId) {
    console.log('⚠️  Cannot auto-update Railway environment variable (missing RAILWAY_API_TOKEN or RAILWAY_PROJECT_ID)');
    console.log('   Please manually update SPREAKER_REFRESH_TOKEN to:', newRefreshToken);
    return;
  }
  
  try {
    const { updateSpeakerRefreshToken } = await import('../utils/railway-env-updater.js');
    await updateSpeakerRefreshToken({
      apiToken: railwayApiToken,
      projectId: projectId,
      environmentId: environmentId,
      refreshToken: newRefreshToken
    });
    oauthOperationCount.railwayUpdates++;
    console.log(`✅ Successfully updated SPREAKER_REFRESH_TOKEN in Railway environment (${context})`);
  } catch (updateError) {
    console.error(`⚠️  Failed to automatically update Railway environment variable during ${context}:`, updateError.message);
    console.error('   Current process will continue with new token, but please manually update SPREAKER_REFRESH_TOKEN to:', newRefreshToken);
  }
}



/**
 * Safely refresh Spreaker access token and update current refresh token state
 * Enhanced with robust one-time-use token rotation and comprehensive logging
 * This prevents token burning by ensuring atomic updates and proper token lifecycle management
 * Includes proactive refresh, retry logic, and concurrency control
 */
async function safeRefreshAccessToken() {
  const refreshStartTime = getCurrentTimestamp();
  logTimestampedEvent('Token refresh cycle started', {
    has_current_token: !!currentAccessToken,
    token_expired: isTokenExpired(),
    refresh_in_progress: refreshInProgress,
    current_refresh_token_suffix: currentRefreshToken ? currentRefreshToken.slice(-8) : null
  });

  // If we have a valid access token that's not expired, return it
  if (currentAccessToken && !isTokenExpired()) {
    logTimestampedEvent('Using existing valid access token - no refresh needed', {
      token_age: tokenIssuedAt ? Math.floor((Date.now() - tokenIssuedAt) / 1000) : null,
      expires_at: tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null
    });
    console.log('✅ Using existing valid access token');
    return currentAccessToken;
  }

  // Prevent concurrent refresh attempts with enhanced logging
  if (refreshInProgress) {
    logTimestampedEvent('Token refresh already in progress - waiting for completion');
    console.log('⏳ Token refresh already in progress, waiting...');
    // Wait for existing refresh to complete (up to 30 seconds)
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      if (!refreshInProgress) {
        if (currentAccessToken && !isTokenExpired()) {
          logTimestampedEvent('Token refresh completed by concurrent process');
          console.log('✅ Token refresh completed by another process');
          return currentAccessToken;
        }
        break;
      }
    }
    // If still in progress after 30s, proceed anyway to avoid deadlock
    if (refreshInProgress) {
      logTimestampedEvent('Token refresh timeout - proceeding with new attempt to avoid deadlock');
      console.warn('⚠️ Token refresh taking too long, proceeding with new refresh attempt');
    }
  }

  refreshInProgress = true;
  
  if (!currentRefreshToken) {
    refreshInProgress = false;
    const error = 'No refresh token available. Please check SPREAKER_REFRESH_TOKEN environment variable.';
    logTimestampedEvent('Token refresh failed - no refresh token available', { error });
    throw new Error(error);
  }
  
  logTimestampedEvent('Starting token refresh with retry logic', {
    max_retries: 3,
    current_refresh_token_suffix: currentRefreshToken.slice(-8),
    base_delay: 1000
  });
  
  const maxRetries = 3;
  const baseDelay = 1000; // Start with 1 second
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      oauthOperationCount.refreshAttempts++;
      
      logTimestampedEvent(`Token refresh attempt ${attempt}/${maxRetries} starting`, {
        attempt_number: attempt,
        total_attempts: oauthOperationCount.refreshAttempts,
        using_token_suffix: currentRefreshToken.slice(-8)
      });
      
      console.log(`🔄 Token refresh attempt ${attempt}/${maxRetries}`);
      
      // Store the refresh token we're using for this attempt to detect if it changes
      const tokenUsedForRefresh = currentRefreshToken;
      
      const tokenResult = await refreshAccessToken({
        client_id: process.env.SPREAKER_CLIENT_ID, 
        client_secret: process.env.SPREAKER_CLIENT_SECRET, 
        refresh_token: tokenUsedForRefresh // Use the token we captured for this attempt
      });
      
      oauthOperationCount.refreshSuccesses++;
      const accessToken = typeof tokenResult === 'string' ? tokenResult : tokenResult.access_token;
      const expiresInSeconds = tokenResult.expires_in || 3600; // Default to 1 hour if not provided
      const issuedAtTime = tokenResult.issued_at || getCurrentTimestamp();
      
      logTimestampedEvent('Token refresh successful - performing atomic update', {
        attempt_number: attempt,
        access_token_present: !!accessToken,
        expires_in: expiresInSeconds,
        new_refresh_token_present: !!tokenResult.refresh_token,
        token_rotation_needed: !!(tokenResult.refresh_token && tokenResult.refresh_token !== tokenUsedForRefresh)
      });
      
      // Perform atomic token update - this is the critical one-time-use enforcement
      atomicTokenUpdate(accessToken, expiresInSeconds, tokenResult.refresh_token, issuedAtTime);
      
      console.log(`✅ Access token refreshed successfully (expires in ${expiresInSeconds} seconds)`);
      console.log(`🕒 Token expires at: ${new Date(tokenExpiresAt).toISOString()}`);
      
      // If we rotated the refresh token, update Railway environment
      if (tokenResult.refresh_token && tokenResult.refresh_token !== tokenUsedForRefresh) {
        logTimestampedEvent('Initiating Railway environment update for token rotation');
        // Use the NEW refresh token (from atomicTokenUpdate) for Railway update
        await updateRailwayEnvironment(currentRefreshToken, 'token refresh');
      }
      
      logTimestampedEvent('Token refresh cycle completed successfully', {
        total_duration_ms: new Date(getCurrentTimestamp()) - new Date(refreshStartTime),
        final_token_suffix: currentRefreshToken ? currentRefreshToken.slice(-8) : null,
        expires_at: new Date(tokenExpiresAt).toISOString()
      });
      
      refreshInProgress = false;
      return accessToken;
      
    } catch (error) {
      oauthOperationCount.refreshFailures++;
      
      logTimestampedEvent(`Token refresh attempt ${attempt}/${maxRetries} failed`, {
        attempt_number: attempt,
        error_type: error.constructor.name,
        error_message: error.message,
        is_invalid_grant: error.message.includes('invalid_grant') || error.message.includes('Invalid refresh token'),
        will_retry: attempt < maxRetries
      });
      
      console.error(`❌ Token refresh attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      // Check if this is an invalid_grant error that won't be resolved by retrying
      if (error.message.includes('invalid_grant') || error.message.includes('Invalid refresh token')) {
        logTimestampedEvent('Critical: Invalid refresh token detected - stopping retries', {
          token_suffix: currentRefreshToken ? currentRefreshToken.slice(-8) : 'undefined',
          manual_intervention_required: true
        });
        
        console.error('');
        console.error('🚨 CRITICAL: Invalid refresh token detected - retries will not help.');
        console.error('   The refresh token stored in Railway environment variables is expired or invalid.');
        console.error('   This requires manual intervention:');
        console.error('   1. Use the oauth-server.js helper to get a new token, or');
        console.error('   2. Manually regenerate from your Spreaker app settings');
        console.error(`   Current token (last 8 chars): ${currentRefreshToken ? currentRefreshToken.slice(-8) : 'undefined'}`);
        console.error('');
        refreshInProgress = false;
        logOAuthStats('invalid_grant error');
        throw error;
      }
      
      // For other errors, continue retry logic if attempts remain
      oauthOperationCount.refreshFailures++;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
        console.log(`⏳ Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(delay);
        continue;
      } else {
        // All retries exhausted
        console.error('');
        console.error('❌ All token refresh attempts failed. This could indicate:');
        console.error('   1. Network connectivity issues');
        console.error('   2. Spreaker API is temporarily unavailable');
        console.error('   3. Invalid client credentials');
        console.error('   4. Rate limiting from too many requests');
        console.error('');
        refreshInProgress = false;
        logOAuthStats('token refresh failure');
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
  
  const maxAttempts = 2; // Original attempt + 1 retry with refreshed token
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      attempts++;
      const tokenToUse = attempts === 1 ? accessToken : await safeRefreshAccessToken();
      
      if (attempts > 1) {
        oauthOperationCount.uploadRetries++;
      }
      
      console.log(`🔄 Upload attempt ${attempts}/${maxAttempts} for episode: ${uploadParams.title}`);
      return await uploadEpisode({ accessToken: tokenToUse, ...uploadParams });
      
    } catch (error) {
      console.error(`❌ Upload attempt ${attempts} failed:`, error.message);
      
      // Check if this is an authentication error that might be resolved with token refresh
      const isAuthError = error.response && (error.response.status === 401 || error.response.status === 403);
      
      if (isAuthError && attempts < maxAttempts) {
        console.log('🔄 Upload failed with auth error, will refresh token and retry...');
        continue; // Retry with fresh token
      } else if (!isAuthError) {
        // Not an auth error, no point in retrying with new token
        console.error('❌ Upload failed with non-auth error, will not retry');
        throw error;
      } else {
        // Final attempt failed
        console.error('❌ Upload failed after all retry attempts');
        // Log stats to help debug upload issues
        logOAuthStats('upload failure');
        throw error;
      }
    }
  }
}

/**
 * Proactive token health check to refresh token before it expires during long processes
 * This helps prevent mid-process authentication failures
 */
async function proactiveTokenHealthCheck() {
  console.log('🩺 Performing proactive token health check...');
  oauthOperationCount.proactiveChecks++;
  
  try {
    // Always refresh the token proactively to ensure we have a fresh access token
    // and to update the refresh token if Spreaker provides a new one
    const accessToken = await safeRefreshAccessToken();
    console.log('✅ Proactive token refresh successful');
    return accessToken;
  } catch (error) {
    console.error('⚠️ Proactive token health check failed:', error.message);
    // Log stats when proactive checks fail
    logOAuthStats('proactive health check failure');
    throw error;
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
 * Returns null if token initialization fails to allow graceful degradation
 */
async function initializeTokens() {
  console.log('🚀 Initializing Spreaker token management...');
  
  if (!currentRefreshToken) {
    const error = new Error('SPREAKER_REFRESH_TOKEN environment variable is not set.');
    console.error('❌ Token initialization failed:', error.message);
    return { success: false, error: error.message };
  }
  
  console.log(`🔑 Using refresh token (last 8 chars): ${currentRefreshToken.slice(-8)}`);
  
  try {
    // Get initial access token
    const accessToken = await safeRefreshAccessToken();
    console.log('✅ Token management initialized successfully');
    console.log('📊 Token status:', getTokenStatus());
    
    return { success: true, accessToken };
  } catch (error) {
    console.error('❌ Token initialization failed:', error.message);
    console.error('🔧 The application will start but episode processing will be skipped.');
    console.error('📧 Admin notification should have been sent if email is configured.');
    
    // Log the specific error type for debugging
    if (error.message.includes('invalid_grant')) {
      console.error('🚨 This appears to be an invalid/expired refresh token issue.');
      console.error('   Manual token regeneration is required to resume episode processing.');
    } else {
      console.error('🌐 This may be a temporary connectivity or API issue.');
      console.error('   The application will continue running and may recover on the next attempt.');
    }
    
    return { success: false, error: error.message };
  }
}

async function main(){
  console.log('Starting weekly run...');
  console.log(`Environment: EPISODE_TIMEZONE=${TZ}, MAX_EPISODES=${MAX_EPISODES}, DRY_RUN=${DRY}`);
  if(!SPREADSHEET_ID||!TAB_NAME) throw new Error('Missing Google Sheet env vars.');
  if(!SHOW_ID) throw new Error('Missing SPREAKER_SHOW_ID.');
  
  // Initialize token management first
  const tokenResult = await initializeTokens();
  
  // If token initialization fails, we can still start the application but skip episode processing
  if (!tokenResult.success) {
    console.error('⚠️ Episode processing will be skipped due to token initialization failure.');
    console.error('🔧 Please resolve the token issue and restart the application.');
    console.error('💡 The application started successfully and will exit gracefully.');
    
    // Log final OAuth statistics for this failed run
    logOAuthStats('startup - token initialization failed');
    
    // Exit gracefully instead of crashing
    console.log('👋 Application exiting gracefully due to token issues.');
    process.exit(0); // Use exit code 0 to indicate controlled shutdown
  }
  
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
  
  // Validate refresh token at startup to catch issues early
  let accessToken = null;
  if (!DRY) { 
    try {
      console.log('🔍 Performing startup token validation and refresh...');
      // Use proactive refresh approach with startup validation logging
      accessToken = await safeRefreshAccessToken();
      console.log('✅ Startup token validation and refresh successful');
    } catch (error) {
      console.error('❌ Startup token validation failed. Exiting gracefully to prevent restart loop.');
      console.error('   Please fix the SPREAKER_REFRESH_TOKEN environment variable and redeploy.');
      console.error('   Service will not auto-restart to avoid burning through tokens.');
      console.error('   Error details:', error.message);
      return; // Exit gracefully without crashing
    }
  }
  
  let episodeProcessed = 0;
  for(const row of toProcess){
    episodeProcessed++;
    
    // Perform proactive token health check for every episode after the first to ensure fresh tokens
    if (!DRY && episodeProcessed > 1) {
      try {
        console.log(`🩺 Performing proactive token health check for episode ${episodeProcessed}...`);
        accessToken = await proactiveTokenHealthCheck();
      } catch (error) {
        console.error('⚠️ Proactive token health check failed, continuing with existing token:', error.message);
        // Continue with existing token - the upload will handle auth failures
      }
    }
    
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
  
  // Log final OAuth statistics for this run
  logOAuthStats('run completion');
}

// Handle unhandled promise rejections to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
  console.error('Stack trace:', reason?.stack || 'No stack trace available');
  logOAuthStats('unhandled rejection');
  // Don't exit immediately, let the main error handler decide
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  logOAuthStats('uncaught exception');
  process.exit(1); // Exit on uncaught exception to prevent undefined state
});

main().catch(err=>{ 
  console.error('Fatal error:', err);
  // Log OAuth stats even on fatal errors to help with debugging
  logOAuthStats('fatal error');
  process.exit(1); 
});
