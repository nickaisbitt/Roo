# Railway Podcast Automation

This Cron job runs once per week on Railway and will:
- Read your Google Sheet for any episode with a publish date from the past year to the next ~2 months that isn't generated yet
- Generate the script + title + plain & HTML descriptions + tags
- TTS with `gpt-4o-mini-tts` (voice `fable`)
- Upload to Spreaker and mark the sheet row as generated

## Automatic Refresh Token Update

The application now automatically updates the Spreaker refresh token in Railway when a new one is received, preventing restart loops due to expired tokens.

### Required Environment Variables for Auto-Update:
- `RAILWAY_API_TOKEN` - Railway API token (get from https://railway.app/account/tokens)
- `RAILWAY_PROJECT_ID` - Railway project ID (found in dashboard URL)
- `RAILWAY_ENVIRONMENT_ID` - Railway environment ID (defaults to 'production')

If these variables are not set, the app will log the new refresh token for manual update.
