// Token Bridge Service
// A separate service for reliable Spreaker token refresh operations
// This service provides a REST API for token management with enhanced reliability
import express from 'express';
import axios from 'axios';
import 'dotenv/config.js';
import crypto from 'crypto';
import { getCurrentTimestamp, detectClockDrift, logTimestampedEvent } from './src/time-utils.js';

const app = express();
app.use(express.json());

const PORT = process.env.BRIDGE_PORT || process.env.PORT || 5000;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || 'change-me-please';

// Validate bridge secret for security
if (BRIDGE_SECRET === 'change-me-please') {
  console.error('🚨 WARNING: Please set a secure BRIDGE_SECRET environment variable');
}

// Token storage (in production, consider using a database or secure storage)
let tokenStore = {
  access_token: null,
  refresh_token: process.env.SPREAKER_REFRESH_TOKEN,
  expires_at: null,
  last_updated: null,
  rotation_count: 0
};

// Enhanced logging for bridge operations
function logBridgeOperation(operation, details = {}) {
  logTimestampedEvent(`Bridge: ${operation}`, {
    ...details,
    timestamp: getCurrentTimestamp(),
    service: 'token-bridge'
  });
}

// Middleware for authentication
function authenticateRequest(req, res, next) {
  const providedSecret = req.headers.authorization?.replace('Bearer ', '') || 
                        req.query.secret || 
                        req.body.secret;
  
  if (!providedSecret || providedSecret !== BRIDGE_SECRET) {
    logBridgeOperation('Authentication failed', {
      ip: req.ip,
      user_agent: req.headers['user-agent']
    });
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid or missing bridge secret'
    });
  }
  next();
}

// Enhanced refresh token function with one-time-use enforcement
async function refreshSprekerToken() {
  const startTime = getCurrentTimestamp();
  
  // Check for system clock drift
  const clockDrift = detectClockDrift();
  if (clockDrift.driftMs > 2000) {
    logBridgeOperation('Clock drift warning', {
      drift_ms: clockDrift.driftMs,
      system_time: clockDrift.systemTime,
      reference_time: clockDrift.referenceTime
    });
    console.warn(`⚠️ System clock drift detected: ${clockDrift.driftMs}ms`);
  }

  if (!tokenStore.refresh_token) {
    throw new Error('No refresh token available in bridge store');
  }

  const tokenUsedForRefresh = tokenStore.refresh_token; // Capture for one-time-use tracking
  
  logBridgeOperation('Token refresh started', {
    old_refresh_token_suffix: tokenUsedForRefresh.slice(-8),
    rotation_count: tokenStore.rotation_count
  });

  try {
    const response = await axios.post('https://api.spreaker.com/v2/oauth2/token', {
      grant_type: 'refresh_token',
      refresh_token: tokenUsedForRefresh,
      client_id: process.env.SPREAKER_CLIENT_ID,
      client_secret: process.env.SPREAKER_CLIENT_SECRET
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000 // 30 second timeout
    });

    const { access_token, expires_in, refresh_token: new_refresh_token } = response.data;
    const refreshTime = getCurrentTimestamp();
    
    // Critical: Implement one-time-use token rotation
    const oldRefreshToken = tokenStore.refresh_token;
    
    // Update token store atomically
    tokenStore = {
      access_token,
      refresh_token: new_refresh_token || oldRefreshToken, // Use new token if provided
      expires_at: Date.now() + (expires_in * 1000),
      last_updated: refreshTime,
      rotation_count: new_refresh_token && new_refresh_token !== oldRefreshToken 
        ? tokenStore.rotation_count + 1 
        : tokenStore.rotation_count
    };

    // Log token rotation with masked sensitive data
    logBridgeOperation('Token refresh completed', {
      access_token_received: !!access_token,
      expires_in_seconds: expires_in,
      new_refresh_token_received: !!new_refresh_token,
      new_refresh_token_suffix: new_refresh_token ? new_refresh_token.slice(-8) : null,
      token_rotated: !!(new_refresh_token && new_refresh_token !== oldRefreshToken),
      rotation_count: tokenStore.rotation_count,
      duration_ms: new Date(refreshTime) - new Date(startTime)
    });

    if (new_refresh_token && new_refresh_token !== oldRefreshToken) {
      console.log(`🔄 Token rotated: ${oldRefreshToken.slice(-8)} → ${new_refresh_token.slice(-8)}`);
      console.log(`🚮 Old refresh token discarded (one-time-use enforced)`);
      
      // In production, update the environment variable
      if (process.env.NODE_ENV === 'production') {
        console.log('⚠️ IMPORTANT: Update SPREAKER_REFRESH_TOKEN environment variable to:', new_refresh_token);
      }
    }

    return {
      access_token,
      expires_in,
      refresh_token: new_refresh_token,
      expires_at: tokenStore.expires_at,
      rotation_count: tokenStore.rotation_count
    };
    
  } catch (error) {
    logBridgeOperation('Token refresh failed', {
      error_message: error.message,
      error_type: error.constructor.name,
      response_status: error.response?.status,
      response_data: error.response?.data,
      duration_ms: new Date(getCurrentTimestamp()) - new Date(startTime)
    });
    
    // Enhanced error analysis for debugging
    if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
      console.error('🚨 Invalid grant error - refresh token may be expired or invalid');
      console.error('🔧 Manual intervention required: Generate new refresh token');
    }
    
    throw error;
  }
}

// API Routes

// Health check with detailed status
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: getCurrentTimestamp(),
    version: '1.0.0',
    service: 'token-bridge',
    token_status: {
      has_access_token: !!tokenStore.access_token,
      has_refresh_token: !!tokenStore.refresh_token,
      token_expires_at: tokenStore.expires_at,
      token_expired: tokenStore.expires_at ? Date.now() >= tokenStore.expires_at : null,
      last_updated: tokenStore.last_updated,
      rotation_count: tokenStore.rotation_count
    },
    environment: {
      has_client_id: !!process.env.SPREAKER_CLIENT_ID,
      has_client_secret: !!process.env.SPREAKER_CLIENT_SECRET,
      has_bridge_secret: !!process.env.BRIDGE_SECRET,
      bridge_secret_secure: process.env.BRIDGE_SECRET !== 'change-me-please'
    },
    clock_drift: detectClockDrift()
  };

  logBridgeOperation('Health check', {
    requester_ip: req.ip
  });

  res.json(health);
});

// Get current token status (protected)
app.get('/token/status', authenticateRequest, (req, res) => {
  logBridgeOperation('Token status requested', {
    requester_ip: req.ip
  });

  res.json({
    has_access_token: !!tokenStore.access_token,
    has_refresh_token: !!tokenStore.refresh_token,
    access_token_suffix: tokenStore.access_token ? tokenStore.access_token.slice(-8) : null,
    refresh_token_suffix: tokenStore.refresh_token ? tokenStore.refresh_token.slice(-8) : null,
    expires_at: tokenStore.expires_at,
    expires_in_seconds: tokenStore.expires_at ? Math.max(0, Math.floor((tokenStore.expires_at - Date.now()) / 1000)) : null,
    token_expired: tokenStore.expires_at ? Date.now() >= tokenStore.expires_at : null,
    last_updated: tokenStore.last_updated,
    rotation_count: tokenStore.rotation_count
  });
});

// Refresh token endpoint (protected)
app.post('/token/refresh', authenticateRequest, async (req, res) => {
  try {
    logBridgeOperation('Token refresh requested', {
      requester_ip: req.ip,
      force_refresh: !!req.body.force
    });

    // Check if we need to refresh or if current token is still valid
    const forceRefresh = req.body.force;
    const tokenExpired = tokenStore.expires_at ? Date.now() >= (tokenStore.expires_at - 300000) : true; // Refresh 5 minutes early
    
    if (!forceRefresh && tokenStore.access_token && !tokenExpired) {
      logBridgeOperation('Using cached token - no refresh needed', {
        expires_in_seconds: Math.floor((tokenStore.expires_at - Date.now()) / 1000)
      });
      
      return res.json({
        access_token: tokenStore.access_token,
        expires_in: Math.floor((tokenStore.expires_at - Date.now()) / 1000),
        cached: true,
        rotation_count: tokenStore.rotation_count
      });
    }

    const result = await refreshSprekerToken();
    
    res.json({
      access_token: result.access_token,
      expires_in: result.expires_in,
      refresh_token: result.refresh_token, // Only returned for environment updates
      expires_at: result.expires_at,
      rotation_count: result.rotation_count,
      cached: false
    });
    
  } catch (error) {
    console.error('Bridge refresh error:', error.message);
    
    res.status(500).json({
      error: 'Token refresh failed',
      message: error.message,
      timestamp: getCurrentTimestamp()
    });
  }
});

// Update refresh token endpoint (for manual token updates)
app.post('/token/update', authenticateRequest, (req, res) => {
  const { refresh_token } = req.body;
  
  if (!refresh_token) {
    return res.status(400).json({
      error: 'Missing refresh_token',
      message: 'refresh_token is required in request body'
    });
  }

  const oldToken = tokenStore.refresh_token;
  tokenStore.refresh_token = refresh_token;
  tokenStore.last_updated = getCurrentTimestamp();
  tokenStore.rotation_count++;

  logBridgeOperation('Manual refresh token update', {
    old_token_suffix: oldToken ? oldToken.slice(-8) : null,
    new_token_suffix: refresh_token.slice(-8),
    requester_ip: req.ip
  });

  console.log(`🔄 Manual token update: ${oldToken?.slice(-8) || 'none'} → ${refresh_token.slice(-8)}`);

  res.json({
    message: 'Refresh token updated successfully',
    new_token_suffix: refresh_token.slice(-8),
    rotation_count: tokenStore.rotation_count
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logBridgeOperation('Unhandled error', {
    error_message: error.message,
    error_type: error.constructor.name,
    path: req.path,
    method: req.method
  });

  console.error('Bridge service error:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : error.message,
    timestamp: getCurrentTimestamp()
  });
});

// Start the bridge service
app.listen(PORT, () => {
  console.log('🌉 Token Bridge Service Started');
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🔐 Authentication: ${process.env.BRIDGE_SECRET ? 'Enabled' : 'Disabled (WARNING!)'})`);
  console.log(`⏰ Started at: ${getCurrentTimestamp()}`);
  
  logBridgeOperation('Service started', {
    port: PORT,
    has_bridge_secret: !!process.env.BRIDGE_SECRET,
    has_spreaker_credentials: !!(process.env.SPREAKER_CLIENT_ID && process.env.SPREAKER_CLIENT_SECRET),
    has_refresh_token: !!process.env.SPREAKER_REFRESH_TOKEN
  });

  // Initial clock drift check
  const clockDrift = detectClockDrift();
  if (clockDrift.driftMs > 2000) {
    console.warn(`⚠️ System clock drift detected at startup: ${clockDrift.driftMs}ms`);
  }
});

export default app;