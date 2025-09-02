// Bridge Client - Integration with Token Bridge Service
// This module provides functions to communicate with the token bridge service
// as a fallback mechanism when direct token refresh fails

import axios from 'axios';
import { getCurrentTimestamp, logTimestampedEvent } from './time-utils.js';

/**
 * Token Bridge Client Configuration
 */
const BRIDGE_CONFIG = {
  baseUrl: process.env.TOKEN_BRIDGE_URL || 'http://localhost:5000',
  secret: process.env.BRIDGE_SECRET || process.env.TOKEN_BRIDGE_SECRET,
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 2000 // 2 seconds base delay
};

/**
 * Log bridge client operations with consistent formatting
 */
function logBridgeClient(operation, details = {}) {
  logTimestampedEvent(`BridgeClient: ${operation}`, {
    ...details,
    timestamp: getCurrentTimestamp(),
    service: 'bridge-client'
  });
}

/**
 * Make authenticated request to bridge service with retry logic
 */
async function makeBridgeRequest(endpoint, options = {}) {
  const { method = 'GET', data, timeout = BRIDGE_CONFIG.timeout } = options;
  
  if (!BRIDGE_CONFIG.secret) {
    throw new Error('Bridge secret not configured - set BRIDGE_SECRET or TOKEN_BRIDGE_SECRET environment variable');
  }

  for (let attempt = 1; attempt <= BRIDGE_CONFIG.retryAttempts; attempt++) {
    try {
      logBridgeClient(`Attempting ${method} ${endpoint}`, {
        attempt,
        max_attempts: BRIDGE_CONFIG.retryAttempts,
        base_url: BRIDGE_CONFIG.baseUrl
      });

      const response = await axios({
        method,
        url: `${BRIDGE_CONFIG.baseUrl}${endpoint}`,
        data,
        timeout,
        headers: {
          'Authorization': `Bearer ${BRIDGE_CONFIG.secret}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Roo-Bridge-Client/1.0.0'
        }
      });

      logBridgeClient(`${method} ${endpoint} successful`, {
        attempt,
        status: response.status,
        response_size: JSON.stringify(response.data).length
      });

      return response.data;

    } catch (error) {
      logBridgeClient(`${method} ${endpoint} failed (attempt ${attempt})`, {
        attempt,
        error_message: error.message,
        error_type: error.constructor.name,
        status: error.response?.status,
        will_retry: attempt < BRIDGE_CONFIG.retryAttempts
      });

      // Don't retry on authentication errors
      if (error.response?.status === 401) {
        throw new Error('Bridge authentication failed - check BRIDGE_SECRET');
      }

      // Don't retry on 4xx errors (except 401 handled above)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }

      if (attempt === BRIDGE_CONFIG.retryAttempts) {
        throw error;
      }

      // Exponential backoff
      const delay = BRIDGE_CONFIG.retryDelay * Math.pow(2, attempt - 1);
      logBridgeClient(`Retrying in ${delay}ms`, { delay, next_attempt: attempt + 1 });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Check if bridge service is available and healthy
 */
export async function checkBridgeHealth() {
  try {
    // First validate the URL before attempting the request
    if (!isValidUrl(process.env.TOKEN_BRIDGE_URL)) {
      const invalidUrlError = `Bridge URL is invalid or not configured: ${process.env.TOKEN_BRIDGE_URL || 'undefined'}`;
      logBridgeClient('Health check failed - invalid URL', {
        error_message: invalidUrlError,
        error_type: 'Configuration',
        env_url: process.env.TOKEN_BRIDGE_URL,
        default_url: BRIDGE_CONFIG.baseUrl
      });
      
      return {
        available: false,
        healthy: false,
        error: invalidUrlError
      };
    }
    
    const startTime = getCurrentTimestamp();
    
    // Public health endpoint - no auth required
    const response = await axios.get(`${BRIDGE_CONFIG.baseUrl}/health`, {
      timeout: 10000 // Shorter timeout for health check
    });

    const endTime = getCurrentTimestamp();
    
    logBridgeClient('Health check successful', {
      status: response.data.status,
      response_time_ms: new Date(endTime) - new Date(startTime),
      bridge_version: response.data.version,
      token_status: response.data.token_status
    });

    return {
      available: true,
      healthy: response.data.status === 'ok',
      response: response.data
    };

  } catch (error) {
    logBridgeClient('Health check failed', {
      error_message: error.message,
      error_type: error.constructor.name,
      status: error.response?.status
    });

    return {
      available: false,
      healthy: false,
      error: error.message
    };
  }
}

/**
 * Get current token status from bridge service
 */
export async function getBridgeTokenStatus() {
  try {
    const data = await makeBridgeRequest('/token/status');
    
    logBridgeClient('Token status retrieved', {
      has_access_token: data.has_access_token,
      token_expired: data.token_expired,
      expires_in_seconds: data.expires_in_seconds,
      rotation_count: data.rotation_count
    });

    return data;

  } catch (error) {
    logBridgeClient('Failed to get token status', {
      error_message: error.message
    });
    throw error;
  }
}

/**
 * Refresh token using bridge service
 * This is the main fallback mechanism when direct token refresh fails
 */
export async function refreshTokenViaBridge(forceRefresh = false) {
  try {
    logBridgeClient('Token refresh requested', {
      force_refresh: forceRefresh
    });

    const data = await makeBridgeRequest('/token/refresh', {
      method: 'POST',
      data: { force: forceRefresh }
    });

    logBridgeClient('Token refresh completed via bridge', {
      cached: data.cached,
      expires_in_seconds: data.expires_in,
      rotation_count: data.rotation_count,
      token_rotated: !!data.refresh_token
    });

    if (data.refresh_token) {
      console.log('🔄 Bridge service rotated refresh token - update environment variables');
      console.log('⚠️ New SPREAKER_REFRESH_TOKEN:', data.refresh_token);
    }

    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
      refresh_token: data.refresh_token,
      cached: data.cached,
      rotation_count: data.rotation_count,
      source: 'bridge'
    };

  } catch (error) {
    logBridgeClient('Token refresh via bridge failed', {
      error_message: error.message,
      error_type: error.constructor.name
    });
    throw error;
  }
}

/**
 * Update refresh token in bridge service (for manual token updates)
 */
export async function updateBridgeRefreshToken(newRefreshToken) {
  try {
    logBridgeClient('Updating refresh token in bridge', {
      new_token_suffix: newRefreshToken.slice(-8)
    });

    const data = await makeBridgeRequest('/token/update', {
      method: 'POST',
      data: { refresh_token: newRefreshToken }
    });

    logBridgeClient('Refresh token updated in bridge', {
      new_token_suffix: data.new_token_suffix,
      rotation_count: data.rotation_count
    });

    return data;

  } catch (error) {
    logBridgeClient('Failed to update refresh token in bridge', {
      error_message: error.message
    });
    throw error;
  }
}

/**
 * Validate if a URL is properly formatted and not a default/fallback value
 */
function isValidUrl(urlString) {
  // Check for empty, undefined, null values
  if (!urlString || urlString.trim() === '') {
    return false;
  }
  
  // Don't allow localhost URLs in production as they indicate misconfiguration
  const trimmedUrl = urlString.trim();
  if (trimmedUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
    return false;
  }
  
  try {
    const url = new URL(trimmedUrl);
    // Must be http or https
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Check if bridge service is configured and available
 */
export function isBridgeConfigured() {
  const hasSecret = !!BRIDGE_CONFIG.secret;
  const hasValidUrl = isValidUrl(process.env.TOKEN_BRIDGE_URL); // Check original env var, not the defaulted value
  
  return hasSecret && hasValidUrl;
}

/**
 * Get bridge configuration status for diagnostics
 */
export function getBridgeConfig() {
  const originalUrl = process.env.TOKEN_BRIDGE_URL;
  return {
    configured: isBridgeConfigured(),
    base_url: BRIDGE_CONFIG.baseUrl,
    original_env_url: originalUrl,
    has_secret: !!BRIDGE_CONFIG.secret,
    url_valid: isValidUrl(originalUrl),
    timeout: BRIDGE_CONFIG.timeout,
    retry_attempts: BRIDGE_CONFIG.retryAttempts
  };
}

export { BRIDGE_CONFIG };