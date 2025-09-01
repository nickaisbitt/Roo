# Roo Podcast Automation - Quick Reference

## Essential Commands

### Check Spreaker Token Status
```bash
curl -X POST https://api.spreaker.com/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "client_id=$SPREAKER_CLIENT_ID" \
  -d "client_secret=$SPREAKER_CLIENT_SECRET" \
  -d "refresh_token=$SPREAKER_REFRESH_TOKEN"
```

### Generate Episode Script (Example)
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system",
        "content": "You are a podcast script writer creating engaging content."
      },
      {
        "role": "user",
        "content": "Create a main podcast script about mindfulness and meditation for busy professionals. Date: 15/01/2024"
      }
    ],
    "max_tokens": 1500,
    "temperature": 0.7
  }'
```

### Generate Audio from Text
```bash
curl -X POST https://api.openai.com/v1/audio/speech \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini-tts",
    "input": "Welcome to today'\''s episode about mindfulness...",
    "voice": "fable",
    "format": "mp3"
  }' \
  --output episode_audio.mp3
```

### Upload Episode to Spreaker
```bash
curl -X POST "https://api.spreaker.com/v2/shows/$SPREAKER_SHOW_ID/episodes" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "media_file=@episode_audio.mp3" \
  -F "title=Mindfulness for Busy Professionals" \
  -F "description=<p>In today's episode, we explore practical mindfulness techniques...</p>" \
  -F "tags=mindfulness,meditation,productivity,wellness" \
  -F "published_at=2024-01-15 08:00:00"
```

## Environment Variables Checklist

### Required
- [ ] `GOOGLE_SHEETS_SPREADSHEET_ID` 
- [ ] `GOOGLE_SHEETS_TAB_NAME`
- [ ] `GOOGLE_SERVICE_ACCOUNT_JSON`
- [ ] `OPENAI_API_KEY`
- [ ] `SPREAKER_CLIENT_ID`
- [ ] `SPREAKER_CLIENT_SECRET` 
- [ ] `SPREAKER_REFRESH_TOKEN`
- [ ] `SPREAKER_SHOW_ID`

### Optional (with defaults)
- [ ] `OPENAI_TEXT_MODEL` (default: "gpt-4o")
- [ ] `MAX_EPISODES_PER_RUN` (default: 2)
- [ ] `EPISODE_TIMEZONE` (default: "UTC")
- [ ] `SPREAKER_PUBLISH_TIME_UTC` (default: "08:00:00")

### For Auto-Updates
- [ ] `RAILWAY_API_TOKEN`
- [ ] `RAILWAY_PROJECT_ID` 
- [ ] `RAILWAY_ENVIRONMENT_ID`

## Google Sheets Structure

### Required Columns
| Column Name | Purpose | Example |
|-------------|---------|---------|
| `publish_date` | Episode publish date | 15/01/2024 |
| `topic` | Episode topic/title | Mindfulness for Professionals |
| `type` | Episode type | main or friday |
| `generated` | Processing status | TRUE/FALSE |

### Auto-Generated Columns  
| Column Name | Purpose | Example |
|-------------|---------|---------|
| `spreaker_episode_id` | Spreaker episode ID | 12345678 |
| `spreaker_url` | Episode URL | https://www.spreaker.com/episode/12345678 |
| `generated_at` | Generation timestamp | 2024-01-15T10:30:00.000Z |

## Episode Types

### Main Podcast
- Longer format with introduction, main content, conclusion
- Comprehensive coverage of topic
- Usually 10-20 minutes

### Friday Healing  
- Shorter healing-focused format
- Meditation or wellness theme
- Usually 5-15 minutes

## Common Error Messages & Solutions

### "invalid_grant" Error
**Cause**: Expired or invalid Spreaker refresh token  
**Solution**: Regenerate token using OAuth helper or Spreaker app settings

### "insufficient_quota" Error
**Cause**: Exceeded OpenAI API usage limits  
**Solution**: Check OpenAI usage dashboard and billing

### "Permission denied" Error  
**Cause**: Google Sheets access issues  
**Solution**: Verify service account permissions and JSON format

### "File not found" Error
**Cause**: Audio file missing or path incorrect  
**Solution**: Verify file exists and path is correct

## File Naming Convention

```
episode_YYYYMMDD_HHMMSS.mp3           # Final audio file
episode_YYYYMMDD_script.txt           # Generated script
episode_YYYYMMDD_title.txt            # Generated title  
episode_YYYYMMDD_description.txt      # Plain description
episode_YYYYMMDD_description.html     # HTML description
episode_YYYYMMDD_tags.txt             # Episode tags
```

## Testing Commands

### Test OpenAI API Access
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}],"max_tokens":10}'
```

### Test Spreaker API Access
```bash
curl -X GET "https://api.spreaker.com/v2/shows/$SPREAKER_SHOW_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Test Google Sheets Access
Use the Google Sheets API Explorer or verify service account JSON format.

## Workflow Summary

1. **Read** episodes from Google Sheets (unprocessed rows)
2. **Generate** content using OpenAI (script, title, description, tags)  
3. **Create** audio using OpenAI TTS (voice: fable)
4. **Upload** episode to Spreaker with metadata
5. **Update** Google Sheets with success status and URLs

## Emergency Procedures  

### If Tokens Break Mid-Process
1. Stop current process
2. Regenerate Spreaker tokens
3. Update environment variables
4. Resume from last successful episode

### If Audio Generation Fails
1. Check text length (max 3,500 chars per chunk)
2. Verify OpenAI API key and quota
3. Try different voice if needed
4. Split long scripts into multiple chunks

### If Upload Fails
1. Verify audio file integrity
2. Check Spreaker API credentials
3. Validate required metadata fields
4. Try manual upload via Spreaker dashboard

---

For complete details, see [MANUAL_WORKFLOW.md](./MANUAL_WORKFLOW.md)