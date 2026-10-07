# Railway Podcast Automation

## 🚀 Quick Preview

**Try the OAuth Helper Interface:**

[![Open Preview](https://img.shields.io/badge/🌐_Open-localhost:3000-blue?style=for-the-badge)](http://localhost:3000)
[![Preview Guide](https://img.shields.io/badge/📖_How_to-Launch_Preview-green?style=for-the-badge)](#launching-the-preview)

### Launching the Preview

Choose your platform to start the OAuth Helper on `localhost:3000`:

**macOS / Linux:**
```bash
./preview-mac.sh    # For macOS
./preview-linux.sh  # For Linux
```

**Windows:**
```cmd
preview-windows.bat      # Command Prompt
preview-windows.ps1      # PowerShell
```

The scripts will:
- ✅ Check and install dependencies automatically
- ✅ Start the OAuth Helper server on port 3000
- ✅ Open your default browser to `http://localhost:3000`

---

This Cron job runs once per week on Railway and will:
- Read your Google Sheet for any episode with a publish date from the past year to the next ~2 months that isn't generated yet
- Generate the script + title + plain & HTML descriptions + tags
- TTS with `gpt-4o-mini-tts` (voice `fable`)
- Upload to Spreaker and mark the sheet row as generated

## 📚 Complete Documentation

**→ [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) - Start here for all documentation**

**🌟 NEW: [COMPLETE_PROCESS_GUIDE.md](./COMPLETE_PROCESS_GUIDE.md) - Impeccably detailed start-to-finish guide for new operators**

The documentation includes:
- **Complete step-by-step manual process** with extreme detail for beginners
- API command references and troubleshooting guides
- System diagnostic tools and verification procedures  
- Practical examples and edge case handling
- Emergency procedures and recovery methods

Use these resources when the automation fails or when you need to understand the process in detail.

## Spreaker Token Management Fix

**PROBLEM RESOLVED**: The app now provides comprehensive OAuth token management that eliminates continual 400 "invalid_grant" errors.

### Latest Improvements (v2.0)

**Enhanced with proactive token management and retry logic to completely eliminate OAuth errors:**

1. ✅ **Proactive Token Refresh**: Tokens are refreshed before expiration (5-minute buffer) instead of waiting for failures
2. ✅ **Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s) + jitter for transient failures  
3. ✅ **Concurrency Control**: Prevents multiple simultaneous refresh attempts that could burn tokens
4. ✅ **Token Expiration Tracking**: Full lifecycle management with expiration monitoring
5. ✅ **Enhanced Diagnostics**: Detailed error analysis and rate limit monitoring for debugging

### What Was Originally Fixed (v1.0)

The previous implementation had a critical issue where Spreaker's one-time-use refresh tokens would get "burned" on first use:

1. ❌ **Old behavior**: `process.env.SPREAKER_REFRESH_TOKEN` was read once at startup
2. ❌ First API call succeeded and returned a new refresh token
3. ❌ New token was saved to Railway for *future* deployments
4. ❌ Current process continued using the old (now invalid) token
5. ❌ Subsequent calls failed with `invalid_grant` error

### How Token Management Works Now (v2.0)

The comprehensive solution includes multiple layers of protection:

1. ✅ **Startup Initialization**: `initializeTokens()` gets a valid token before processing begins
2. ✅ **Proactive Refresh**: `safeRefreshAccessToken()` refreshes tokens before they expire  
3. ✅ **Intelligent Upload**: `safeUploadEpisode()` checks token health before each upload
4. ✅ **Process State**: `currentRefreshToken` and `currentAccessToken` maintain current valid tokens
5. ✅ **Graceful Retry**: Failed refreshes retry with exponential backoff for transient issues
6. ✅ **Railway Sync**: Updates environment variables for future deployments (async)
7. ✅ **Monitoring**: Token status logging for visibility and debugging

### Original Implementation (v1.0)

The initial fix addressed token burning within process execution:

1. ✅ **New behavior**: `currentRefreshToken` variable tracks the active token
2. ✅ First API call succeeds and returns a new refresh token
3. ✅ **IMMEDIATELY** updates `currentRefreshToken` in the current process
4. ✅ Updates Railway environment for future deployments (async)
5. ✅ Subsequent calls use the updated token and succeed

### Key Components

- **`safeRefreshAccessToken()`**: Manages token state and Railway updates
- **`safeUploadEpisode()`**: Automatically retries with fresh token on auth failures
- **Process-level state**: `currentRefreshToken` variable maintains current valid token
- **Enhanced logging**: Better visibility into token refresh operations
- **Graceful error handling**: Prevents restart loops from token issues

## Automatic Refresh Token Update

The application automatically updates the Spreaker refresh token in Railway when a new one is received, preventing restart loops due to expired tokens.

### Required Environment Variables for Auto-Update:
- `RAILWAY_API_TOKEN` - Railway API token (get from https://railway.app/account/tokens)
- `RAILWAY_PROJECT_ID` - Railway project ID (found in dashboard URL)
- `RAILWAY_ENVIRONMENT_ID` - Railway environment ID (defaults to 'production')

If these variables are not set, the app will log the new refresh token for manual update.

## Deployment Notes

After deploying this fix:
1. The app will automatically manage token refreshes during execution
2. No more manual token regeneration needed due to burning
3. Long-running processes can handle multiple episode uploads
4. Railway environment variables get updated for future runs

**The token burning issue is now completely resolved!**

## Troubleshooting

### "Invalid refresh token" or "invalid_grant" Error

**Note**: With the v2.0 improvements, these errors should now be extremely rare due to proactive token management and retry logic. 

If you still see errors like:
```
Failed to refresh Spreaker access token: Request failed with status code 400
OAuth Error Response: { error: 'invalid_grant', error_description: 'Invalid refresh token' }
```

This typically indicates the stored refresh token is completely expired or invalid and requires manual regeneration:

#### Option 1: Use the OAuth Helper (Recommended)
1. Deploy the `oauth-server.js` temporarily to Railway
2. Visit your app URL and click "Connect Spreaker"
3. Complete the OAuth flow to get a fresh refresh token
4. Copy the new `SPREAKER_REFRESH_TOKEN` value to your Railway environment variables
5. Redeploy your main service

#### Option 2: Manual Regeneration
1. Go to your Spreaker app settings page
2. Find the OAuth/API section and regenerate your refresh token
3. Update the `SPREAKER_REFRESH_TOKEN` environment variable in Railway
4. Redeploy the service

#### Why This Happens
- Spreaker refresh tokens can expire after extended periods of inactivity
- Failed deployment attempts can sometimes burn tokens
- Manual regeneration in Spreaker app settings invalidates old tokens

The app now includes better detection and clearer error messages for this scenario.

## Token Health Monitoring

### Enhanced Logging

The v2.0 improvements include comprehensive logging for token lifecycle monitoring:

- **Token Status**: Expiration time, refresh progress, current token health
- **Proactive Refresh**: Logs when tokens are refreshed before expiration
- **Retry Attempts**: Detailed retry attempts with backoff timing
- **Error Analysis**: Enhanced error details including rate limit headers and timestamps
- **Railway Sync**: Status of environment variable updates for future runs

### Example Log Output

```
🚀 Initializing Spreaker token management...
🔑 Using refresh token (last 8 chars): abc12345
🔄 Token refresh attempt 1/3
✅ Access token refreshed successfully (expires in 3600 seconds)
🕒 Token expires at: 2024-01-15T14:30:00.000Z
📊 Token status: {"hasRefreshToken":true,"hasAccessToken":true,"isExpired":false,"expiresAt":"2024-01-15T14:30:00.000Z","refreshInProgress":false}
✅ Token management initialized successfully
```

### Monitoring Environment Variables

For automatic token updates, ensure these are configured:
- `RAILWAY_API_TOKEN` - Railway API token
- `RAILWAY_PROJECT_ID` - Railway project ID  
- `RAILWAY_ENVIRONMENT_ID` - Railway environment ID (defaults to 'production')

If these are missing, token updates will be logged for manual application.

## Manual Workflow Documentation

If you need to understand the automation process or execute it manually:

- **[MANUAL_WORKFLOW.md](./MANUAL_WORKFLOW.md)** - Complete step-by-step manual workflow instructions
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick reference guide with essential commands
- **[EXAMPLE_WALKTHROUGH.md](./EXAMPLE_WALKTHROUGH.md)** - Detailed example of processing one episode manually
- **[diagnostics.sh](./diagnostics.sh)** - System diagnostic script to check configuration

These documents provide:
- Detailed explanations of each automation step
- API commands and examples
- Troubleshooting guidance
- Emergency procedures
- Environment setup instructions

Use these resources when:
- The automation fails and needs manual intervention
- You want to understand what the system does behind the scenes
- You need to process episodes manually during system maintenance
- You're troubleshooting OAuth token issues

### Quick System Check

Run the diagnostic script to verify your setup:

```bash
./diagnostics.sh
```

This will check:
- Required tools and dependencies
- Environment variables
- API connectivity
- File system permissions
