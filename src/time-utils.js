/**
 * Time utilities for system clock drift detection and timestamp logging
 */

// Cache for system clock drift detection
let lastClockCheck = null;
let clockDriftWarningShown = false;

/**
 * Get current UTC timestamp with millisecond precision
 * @returns {string} ISO timestamp
 */
export function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Get current UTC timestamp for logging with microsecond precision where available
 * @returns {string} High precision timestamp
 */
export function getHighPrecisionTimestamp() {
  if (typeof performance !== 'undefined' && performance.now) {
    const now = Date.now();
    const precise = performance.now() % 1000;
    const date = new Date(now);
    return date.toISOString().replace(/(\.\d{3})Z$/, `.${precise.toFixed(3).padStart(6, '0').slice(0, 3)}Z`);
  }
  return getCurrentTimestamp();
}

/**
 * Detect system clock drift by comparing with expected time progression
 * @param {number} driftThresholdSeconds - Maximum acceptable drift (default: 2 seconds)
 * @returns {Object} Drift detection result
 */
export function detectClockDrift(driftThresholdSeconds = 2) {
  const now = Date.now();
  const result = {
    timestamp: new Date(now).toISOString(),
    hasDrift: false,
    driftSeconds: 0,
    serverTime: new Date(now).toISOString(),
    warning: null
  };

  // For first check, just record the time
  if (!lastClockCheck) {
    lastClockCheck = {
      timestamp: now,
      serverTime: now
    };
    return result;
  }

  // Calculate expected time progression
  const expectedElapsed = now - lastClockCheck.timestamp;
  const actualElapsed = now - lastClockCheck.serverTime;
  const drift = Math.abs(actualElapsed - expectedElapsed) / 1000;

  result.driftSeconds = drift;
  result.hasDrift = drift > driftThresholdSeconds;

  if (result.hasDrift) {
    result.warning = `System clock drift detected: ${drift.toFixed(2)}s (threshold: ${driftThresholdSeconds}s)`;
    
    if (!clockDriftWarningShown) {
      console.error('⚠️  SYSTEM CLOCK DRIFT DETECTED:');
      console.error(`   Detected drift: ${drift.toFixed(2)} seconds`);
      console.error(`   Threshold: ${driftThresholdSeconds} seconds`);
      console.error(`   Server time: ${result.serverTime}`);
      console.error('   This may cause OAuth token expiration issues.');
      console.error('   Consider synchronizing the system clock (NTP sync).');
      console.error('');
      clockDriftWarningShown = true;
    }
  }

  // Update last check
  lastClockCheck = {
    timestamp: now,
    serverTime: now
  };

  return result;
}

/**
 * Validate timestamp against system clock and detect drift
 * @param {string|Date} timestamp - Timestamp to validate
 * @param {number} maxAgeSeconds - Maximum acceptable age in seconds (default: 300)
 * @returns {Object} Validation result
 */
export function validateTimestamp(timestamp, maxAgeSeconds = 300) {
  const now = Date.now();
  const targetTime = new Date(timestamp).getTime();
  
  if (isNaN(targetTime)) {
    return {
      valid: false,
      reason: 'Invalid timestamp format',
      timestamp: getCurrentTimestamp()
    };
  }

  const ageSeconds = Math.abs(now - targetTime) / 1000;
  const result = {
    valid: ageSeconds <= maxAgeSeconds,
    ageSeconds: ageSeconds,
    reason: ageSeconds > maxAgeSeconds ? `Timestamp too old: ${ageSeconds.toFixed(1)}s` : null,
    timestamp: getCurrentTimestamp()
  };

  // Also check for clock drift if timestamp is in the future
  if (targetTime > now + (2 * 1000)) { // More than 2 seconds in the future
    result.clockDrift = {
      detected: true,
      futureBySeconds: (targetTime - now) / 1000,
      warning: 'Timestamp indicates possible system clock drift (timestamp in future)'
    };
  }

  return result;
}

/**
 * Log a timestamped event with optional metadata
 * @param {string} event - Event name/description
 * @param {Object} metadata - Optional metadata to log
 * @param {boolean} highPrecision - Use high precision timestamp (default: false)
 */
export function logTimestampedEvent(event, metadata = {}, highPrecision = false) {
  const timestamp = highPrecision ? getHighPrecisionTimestamp() : getCurrentTimestamp();
  
  console.log(`🕒 [${timestamp}] ${event}`);
  
  if (Object.keys(metadata).length > 0) {
    // Mask sensitive data in metadata
    const maskedMetadata = maskSensitiveData(metadata);
    console.log('   Metadata:', JSON.stringify(maskedMetadata, null, 2));
  }
}

/**
 * Mask sensitive data for logging
 * @param {Object} data - Data to mask
 * @returns {Object} Masked data
 */
function maskSensitiveData(data) {
  const masked = { ...data };
  const sensitiveKeys = ['token', 'secret', 'password', 'key', 'auth', 'refresh_token', 'access_token'];
  
  for (const [key, value] of Object.entries(masked)) {
    if (typeof value === 'string' && sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      // Show first 4 and last 4 characters for tokens, or just length for very short ones
      if (value.length > 16) {
        masked[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
      } else if (value.length > 8) {
        masked[key] = `${value.substring(0, 2)}...${value.substring(value.length - 2)}`;
      } else {
        masked[key] = `[${value.length} chars]`;
      }
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    }
  }
  
  return masked;
}

/**
 * Reset clock drift warning flag (for testing)
 */
export function resetClockDriftWarning() {
  clockDriftWarningShown = false;
  lastClockCheck = null;
}