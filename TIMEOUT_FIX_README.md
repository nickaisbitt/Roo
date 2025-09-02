# Timeout Configuration Fix for Railway Container Restarts

## Problem Resolved
Fixed an issue where the Roo application would get stuck in an endless restart loop on Railway due to HTTP requests hanging indefinitely.

## Root Cause
The axios HTTP client was making requests to Spreaker's API without timeout configuration. In Railway's containerized environment, when network issues or API slowdowns occurred, requests would hang indefinitely, causing the container health checks to fail and trigger restarts.

## Solution
Added appropriate timeout configurations to all axios requests in `src/spreaker.js`:

### OAuth Requests (15 second timeout)
- Credential validation requests
- Token refresh requests

### File Upload Requests (60 second timeout)  
- Episode upload requests (longer timeout for large audio files)

## Timeout Values Chosen
- **15 seconds** for OAuth API calls: Fast enough to prevent container issues, allows for network latency
- **60 seconds** for file uploads: Accommodates large audio files while still preventing indefinite hangs

## Verification
The fix ensures:
✅ Requests fail gracefully with network errors instead of hanging
✅ Retry logic works properly with timeout failures
✅ Application exits cleanly instead of causing container restarts
✅ No impact on normal operation when APIs respond normally

## Files Modified
- `src/spreaker.js`: Added timeout configuration to 3 axios.post calls

## Bridge Client
The bridge client (`src/bridge-client.js`) already had proper timeout configuration (30 seconds) and did not require changes.