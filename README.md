# Railway Podcast Automation

This Cron job runs once per week on Railway and will:
- Read your Google Sheet for any episode with a publish date from the past year to the next ~2 months that isn't generated yet
- Generate the script + title + plain & HTML descriptions + tags
- TTS with `gpt-4o-mini-tts` (voice `fable`)
- Upload to Spreaker and mark the sheet row as generated

## Spreaker Token Management Fix

**PROBLEM SOLVED**: The app no longer burns through Spreaker refresh tokens on multiple uses within the same process execution.

### What Was Fixed

The previous implementation had a critical issue where Spreaker's one-time-use refresh tokens would get "burned" on first use:

1. ❌ **Old behavior**: `process.env.SPREAKER_REFRESH_TOKEN` was read once at startup
2. ❌ First API call succeeded and returned a new refresh token
3. ❌ New token was saved to Railway for *future* deployments
4. ❌ Current process continued using the old (now invalid) token
5. ❌ Subsequent calls failed with `invalid_grant` error

### How It's Fixed

The new implementation maintains refresh token state throughout the process execution:

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

If you see errors like:
```
Failed to refresh Spreaker access token: Request failed with status code 400
OAuth Error Response: { error: 'invalid_grant', error_description: 'Invalid refresh token' }
```

This means your stored refresh token has expired. Here's how to fix it:

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
