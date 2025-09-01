# Manual Workflow Instructions for Roo Podcast Automation

## Overview

This document provides step-by-step instructions for manually executing the podcast generation and upload workflow that is normally automated by the Roo system. Use this guide when the automation is not working or when you need to understand the process in detail.

## Prerequisites

Before starting, ensure you have:

1. **Google Sheets Access**: Access to your podcast episode tracking spreadsheet
2. **OpenAI API Key**: For content generation and text-to-speech
3. **Spreaker Account**: With OAuth credentials and show access
4. **Required Tools**: curl, ffmpeg (if concatenating audio), text editor

## Environment Variables

The following environment variables are used by the automated system. For manual workflow, you'll need these values:

### Required Variables
- `GOOGLE_SHEETS_SPREADSHEET_ID` - Your Google Sheets document ID
- `GOOGLE_SHEETS_TAB_NAME` - Name of the sheet tab (e.g., "Episodes")
- `GOOGLE_SERVICE_ACCOUNT_JSON` - Google service account credentials JSON
- `OPENAI_API_KEY` - Your OpenAI API key
- `SPREAKER_CLIENT_ID` - Spreaker OAuth client ID
- `SPREAKER_CLIENT_SECRET` - Spreaker OAuth client secret
- `SPREAKER_REFRESH_TOKEN` - Current Spreaker refresh token
- `SPREAKER_SHOW_ID` - Your Spreaker show ID
- `SPREAKER_PUBLISH_TIME_UTC` - Default publish time (e.g., "08:00:00")

### Optional Variables
- `OPENAI_TEXT_MODEL` - Text generation model (default: "gpt-4o")
- `MAX_EPISODES_PER_RUN` - Max episodes to process (default: 2)
- `EPISODE_TIMEZONE` - Timezone for episode dates (default: "UTC")

## Step 1: Read Episode Data from Google Sheets

### 1.1 Access Your Spreadsheet

1. Open your Google Sheets document using the `GOOGLE_SHEETS_SPREADSHEET_ID`
2. Navigate to the tab specified by `GOOGLE_SHEETS_TAB_NAME`
3. Look for episodes that meet these criteria:
   - Have a publish date within the past year to next ~2 months
   - The "generated" column is empty or FALSE
   - Have a valid topic/title

### 1.2 Expected Sheet Structure

Your sheet should have columns like:
- `publish_date` (or `date`, `episode date`, `publish`) - Format: DD/MM/YYYY
- `topic` (or `title`, `episode topic`, `episode title`) - Episode subject
- `type` (or `episode_type`, `episode type`) - "main" or "friday" 
- `generated` - TRUE/FALSE status
- `spreaker_episode_id` - Spreaker episode ID (populated after upload)
- `spreaker_url` - Episode URL (populated after upload)
- `generated_at` - Timestamp when generated

### 1.3 Select Episodes to Process

1. Identify episodes that need processing
2. Note the row numbers for tracking
3. Record the topic, date, and type for each episode

## Step 2: Generate Content with OpenAI

### 2.1 Prepare Episode Structure

The system supports two episode types:
- **Main Podcast**: Longer format with introduction, main content, and conclusion
- **Friday Healing**: Shorter healing-focused format

### 2.2 Generate Script Content

For each episode, you'll need to generate:

#### A. Episode Script
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system", 
        "content": "You are a podcast script writer. Create an engaging podcast script."
      },
      {
        "role": "user",
        "content": "Create a [EPISODE_TYPE] podcast script about: [TOPIC]. Date: [DATE]"
      }
    ],
    "max_tokens": 1500,
    "temperature": 0.7
  }'
```

#### B. Episode Title
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system",
        "content": "You are a podcast title creator. Create compelling, SEO-friendly titles."
      },
      {
        "role": "user", 
        "content": "Create a title for a [EPISODE_TYPE] podcast about: [TOPIC]"
      }
    ],
    "max_tokens": 100,
    "temperature": 0.7
  }'
```

#### C. Episode Description (Plain Text)
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system",
        "content": "You are a podcast description writer. Create engaging descriptions."
      },
      {
        "role": "user",
        "content": "Create a description for a [EPISODE_TYPE] podcast about: [TOPIC]"
      }
    ],
    "max_tokens": 300,
    "temperature": 0.7
  }'
```

#### D. Episode Description (HTML)
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o", 
    "messages": [
      {
        "role": "system",
        "content": "You are a podcast description writer. Create HTML-formatted descriptions."
      },
      {
        "role": "user",
        "content": "Create an HTML description for a [EPISODE_TYPE] podcast about: [TOPIC]"
      }
    ],
    "max_tokens": 400,
    "temperature": 0.7
  }'
```

#### E. Episode Tags
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system",
        "content": "You are a podcast tag generator. Create relevant tags separated by commas."
      },
      {
        "role": "user",
        "content": "Create tags for a [EPISODE_TYPE] podcast about: [TOPIC]"
      }
    ],
    "max_tokens": 100,
    "temperature": 0.7
  }'
```

### 2.3 Save Generated Content

Save all generated content in organized files:
- `episode_script.txt` - The main podcast script
- `episode_title.txt` - Episode title
- `episode_description.txt` - Plain text description
- `episode_description.html` - HTML description  
- `episode_tags.txt` - Comma-separated tags

## Step 3: Generate Audio with Text-to-Speech

### 3.1 Split Script for TTS

If your script is longer than 3,500 characters, split it into smaller chunks to avoid TTS limits.

### 3.2 Generate Audio Chunks

For each text chunk:

```bash
curl -X POST https://api.openai.com/v1/audio/speech \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini-tts",
    "input": "[SCRIPT_CHUNK_TEXT]",
    "voice": "fable",
    "format": "mp3"
  }' \
  --output chunk_01.mp3
```

### 3.3 Concatenate Audio (if multiple chunks)

If you have multiple audio chunks, concatenate them:

1. Create a file list (`concat_list.txt`):
```
file 'chunk_01.mp3'
file 'chunk_02.mp3'
file 'chunk_03.mp3'
```

2. Use ffmpeg to concatenate:
```bash
ffmpeg -y -f concat -safe 0 -i concat_list.txt -c copy final_episode.mp3
```

3. Clean up temporary files:
```bash
rm chunk_*.mp3 concat_list.txt
```

## Step 4: Manage Spreaker Authentication

### 4.1 Check Current Refresh Token

Verify your refresh token is valid by attempting to get an access token:

```bash
curl -X POST https://api.spreaker.com/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "client_id=$SPREAKER_CLIENT_ID" \
  -d "client_secret=$SPREAKER_CLIENT_SECRET" \
  -d "refresh_token=$SPREAKER_REFRESH_TOKEN"
```

Expected response:
```json
{
  "access_token": "new_access_token_here",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "new_refresh_token_here"
}
```

### 4.2 Handle Token Refresh

If you receive a new refresh token, update your environment:
1. Save the new `refresh_token` value
2. Use the `access_token` for uploads
3. Update your environment variables or Railway settings

### 4.3 Regenerate Expired Tokens

If you get an "invalid_grant" error, regenerate tokens:

#### Option A: Use OAuth Helper
1. Deploy the `oauth-server.js` temporarily
2. Visit the OAuth helper URL
3. Complete the Spreaker authorization flow
4. Copy the new refresh token

#### Option B: Manual Regeneration
1. Go to your Spreaker app settings
2. Navigate to the OAuth/API section
3. Regenerate your refresh token
4. Update your environment variables

## Step 5: Upload Episode to Spreaker

### 5.1 Prepare Upload

Ensure you have:
- Generated audio file (`final_episode.mp3`)
- Episode title
- Episode description (HTML preferred)
- Episode tags (comma-separated)
- Publish date and time in UTC format

### 5.2 Upload Episode

```bash
curl -X POST "https://api.spreaker.com/v2/shows/$SPREAKER_SHOW_ID/episodes" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "media_file=@final_episode.mp3" \
  -F "title=Episode Title Here" \
  -F "description=<p>HTML description here</p>" \
  -F "tags=tag1,tag2,tag3" \
  -F "published_at=2024-01-15 08:00:00"
```

### 5.3 Handle Upload Response

Successful response:
```json
{
  "response": {
    "episode": {
      "episode_id": 12345678,
      "title": "Episode Title",
      "download_url": "https://www.spreaker.com/episode/12345678",
      "published_at": "2024-01-15T08:00:00Z"
    }
  }
}
```

Note the `episode_id` for updating your tracking sheet.

## Step 6: Update Google Sheets

### 6.1 Mark Episode as Generated

Update your spreadsheet to reflect the completed episode:

1. Set `generated` column to `TRUE`
2. Add `spreaker_episode_id` (from upload response)
3. Add `spreaker_url`: `https://www.spreaker.com/episode/[EPISODE_ID]`
4. Add `generated_at` timestamp (ISO 8601 format)

### 6.2 Verify Updates

Double-check that:
- The row is marked as generated
- The Spreaker URL is correct and accessible
- All tracking information is complete

## Troubleshooting

### Common Issues

#### 1. Google Sheets Access Errors
- **Problem**: Cannot read from or write to Google Sheets
- **Solution**: Verify service account credentials and permissions

#### 2. OpenAI API Errors  
- **Problem**: Content generation fails
- **Solutions**:
  - Check API key validity
  - Verify sufficient credit balance
  - Reduce request size if hitting limits

#### 3. TTS Failures
- **Problem**: Audio generation fails
- **Solutions**:
  - Check text length (max ~3,500 chars per request)
  - Verify voice parameter ("fable")
  - Ensure valid OpenAI API access

#### 4. Spreaker Authentication Issues
- **Problem**: "invalid_grant" or token errors
- **Solutions**:
  - Regenerate refresh token using OAuth helper
  - Check client ID and secret
  - Verify token format and length

#### 5. Upload Failures
- **Problem**: Episode upload to Spreaker fails  
- **Solutions**:
  - Verify audio file exists and isn't corrupted
  - Check file size limits
  - Ensure all required fields are provided
  - Validate HTML in description

### Debugging Steps

1. **Check Environment Variables**: Ensure all required variables are set
2. **Validate API Keys**: Test each API key independently
3. **Review Logs**: Look for specific error messages and response codes
4. **Test Components**: Test each step individually before running full workflow
5. **Verify Data Formats**: Check date formats, HTML validity, tag formatting

## Recovery Procedures

### If Automation Fails Mid-Process

1. **Check Partial Progress**: Review which episodes were completed
2. **Clean Up**: Remove temporary files and incomplete uploads
3. **Resume from Last Success**: Continue from the last successfully processed episode
4. **Update Tracking**: Ensure Google Sheets reflects actual status

### If Authentication Breaks

1. **Regenerate Tokens**: Use OAuth helper or Spreaker settings
2. **Update Environment**: Set new tokens in Railway/environment
3. **Test Authentication**: Verify new tokens work before resuming
4. **Monitor Status**: Watch for recurring token issues

## Best Practices

1. **Process in Batches**: Don't try to process too many episodes at once
2. **Monitor Quotas**: Be aware of API rate limits and quotas
3. **Backup Content**: Save generated content before uploading
4. **Test Uploads**: Verify episodes are properly published
5. **Update Tracking**: Always update your spreadsheet after successful uploads
6. **Regular Maintenance**: Periodically check token validity and system health

## Support Resources

- **Spreaker API Documentation**: https://developers.spreaker.com/
- **OpenAI API Documentation**: https://platform.openai.com/docs
- **Google Sheets API**: https://developers.google.com/sheets/api
- **Railway Documentation**: https://docs.railway.app/

---

This manual workflow serves as both a backup process and a detailed explanation of what the automated system does. Use it for troubleshooting, understanding the flow, or when manual intervention is required.