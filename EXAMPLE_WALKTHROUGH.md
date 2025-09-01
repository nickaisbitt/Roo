# Example Walkthrough: Processing One Episode Manually

This is a complete example of manually processing a single podcast episode from start to finish.

## Scenario

**Episode Data from Google Sheets:**
- Row: 15
- Publish Date: 20/01/2024  
- Topic: "Morning Meditation for Stress Relief"
- Type: "friday"
- Generated: FALSE

**Goal:** Generate and upload this Friday Healing episode to Spreaker.

## Step 1: Set Up Environment

```bash
# Set your environment variables (replace with actual values)
export OPENAI_API_KEY="sk-your-openai-key-here"
export SPREAKER_CLIENT_ID="12345"
export SPREAKER_CLIENT_SECRET="your-spreaker-secret"
export SPREAKER_REFRESH_TOKEN="your-current-refresh-token"
export SPREAKER_SHOW_ID="987654"
```

## Step 2: Generate Spreaker Access Token

```bash
# Test and refresh Spreaker token
curl -X POST https://api.spreaker.com/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "client_id=$SPREAKER_CLIENT_ID" \
  -d "client_secret=$SPREAKER_CLIENT_SECRET" \
  -d "refresh_token=$SPREAKER_REFRESH_TOKEN" \
  -o token_response.json

# Extract access token (you can also do this manually)
ACCESS_TOKEN=$(cat token_response.json | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
echo "Access Token: $ACCESS_TOKEN"

# Check if new refresh token was provided
NEW_REFRESH_TOKEN=$(cat token_response.json | grep -o '"refresh_token":"[^"]*' | cut -d'"' -f4)
if [ ! -z "$NEW_REFRESH_TOKEN" ] && [ "$NEW_REFRESH_TOKEN" != "$SPREAKER_REFRESH_TOKEN" ]; then
  echo "New refresh token received: $NEW_REFRESH_TOKEN"
  echo "Update your SPREAKER_REFRESH_TOKEN environment variable!"
  export SPREAKER_REFRESH_TOKEN="$NEW_REFRESH_TOKEN"
fi
```

## Step 3: Generate Episode Content

### Generate Script
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system",
        "content": "You are a meditation teacher creating healing podcast scripts. Create calming, gentle content that guides listeners through mindfulness practices. Include a brief introduction, main meditation practice, and peaceful closing. Keep the tone soothing and supportive."
      },
      {
        "role": "user",
        "content": "Create a Friday Healing podcast script about: Morning Meditation for Stress Relief. This should be a guided meditation session helping listeners start their day with calm and clarity. Date: 20/01/2024"
      }
    ],
    "max_tokens": 1500,
    "temperature": 0.7
  }' \
  -o script_response.json

# Extract the script content
cat script_response.json | grep -o '"content":"[^"]*' | cut -d'"' -f4 | sed 's/\\n/\n/g' > episode_script.txt
echo "Generated script saved to episode_script.txt"
```

### Generate Title
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system",
        "content": "You are a podcast title creator. Create compelling, SEO-friendly titles that are concise and engaging. For Friday Healing episodes, emphasize the healing/wellness aspect."
      },
      {
        "role": "user",
        "content": "Create a title for a Friday Healing podcast episode about: Morning Meditation for Stress Relief"
      }
    ],
    "max_tokens": 100,
    "temperature": 0.7
  }' \
  -o title_response.json

cat title_response.json | grep -o '"content":"[^"]*' | cut -d'"' -f4 > episode_title.txt
echo "Generated title: $(cat episode_title.txt)"
```

### Generate HTML Description
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system",
        "content": "You are a podcast description writer. Create engaging HTML-formatted descriptions that include paragraph tags and emphasize key benefits. Make it compelling for potential listeners."
      },
      {
        "role": "user",
        "content": "Create an HTML description for a Friday Healing podcast episode about: Morning Meditation for Stress Relief"
      }
    ],
    "max_tokens": 400,
    "temperature": 0.7
  }' \
  -o description_response.json

cat description_response.json | grep -o '"content":"[^"]*' | cut -d'"' -f4 | sed 's/\\n/\n/g' > episode_description.html
echo "Generated HTML description saved to episode_description.html"
```

### Generate Tags
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system",
        "content": "You are a podcast tag generator. Create relevant tags separated by commas. Focus on SEO-friendly terms that listeners might search for. Limit to 8-10 tags maximum."
      },
      {
        "role": "user",
        "content": "Create tags for a Friday Healing podcast episode about: Morning Meditation for Stress Relief"
      }
    ],
    "max_tokens": 100,
    "temperature": 0.7
  }' \
  -o tags_response.json

cat tags_response.json | grep -o '"content":"[^"]*' | cut -d'"' -f4 > episode_tags.txt
echo "Generated tags: $(cat episode_tags.txt)"
```

## Step 4: Generate Audio

```bash
# Check script length
SCRIPT_LENGTH=$(wc -c < episode_script.txt)
echo "Script length: $SCRIPT_LENGTH characters"

if [ $SCRIPT_LENGTH -gt 3500 ]; then
  echo "Script is too long for single TTS request. You'll need to split it."
  # For this example, we'll assume it's under the limit
fi

# Generate audio using TTS
curl -X POST https://api.openai.com/v1/audio/speech \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"gpt-4o-mini-tts\",
    \"input\": \"$(cat episode_script.txt | sed 's/"/\\"/g' | tr '\n' ' ')\",
    \"voice\": \"fable\",
    \"format\": \"mp3\"
  }" \
  --output episode_audio.mp3

echo "Audio generated: episode_audio.mp3"
ls -lh episode_audio.mp3
```

## Step 5: Upload to Spreaker

```bash
# Prepare the upload data
EPISODE_TITLE=$(cat episode_title.txt)
EPISODE_DESCRIPTION=$(cat episode_description.html)
EPISODE_TAGS=$(cat episode_tags.txt)
PUBLISH_DATE="2024-01-20 08:00:00"  # Convert from 20/01/2024

echo "Uploading episode:"
echo "Title: $EPISODE_TITLE"
echo "Tags: $EPISODE_TAGS"
echo "Publish Date: $PUBLISH_DATE"

# Upload to Spreaker
curl -X POST "https://api.spreaker.com/v2/shows/$SPREAKER_SHOW_ID/episodes" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "media_file=@episode_audio.mp3" \
  -F "title=$EPISODE_TITLE" \
  -F "description=$EPISODE_DESCRIPTION" \
  -F "tags=$EPISODE_TAGS" \
  -F "published_at=$PUBLISH_DATE" \
  -o upload_response.json

# Check upload result
if [ $? -eq 0 ]; then
  echo "Upload successful!"
  cat upload_response.json | jq .
  
  # Extract episode ID and URL
  EPISODE_ID=$(cat upload_response.json | grep -o '"episode_id":[0-9]*' | cut -d':' -f2)
  EPISODE_URL="https://www.spreaker.com/episode/$EPISODE_ID"
  
  echo "Episode ID: $EPISODE_ID"
  echo "Episode URL: $EPISODE_URL"
else
  echo "Upload failed!"
  cat upload_response.json
fi
```

## Step 6: Update Google Sheets

Since updating Google Sheets programmatically requires service account authentication, here's what you need to do manually:

1. **Open your Google Sheet**
2. **Find row 15** (the episode we just processed)
3. **Update these columns:**
   - `generated`: TRUE
   - `spreaker_episode_id`: [EPISODE_ID from upload response]
   - `spreaker_url`: https://www.spreaker.com/episode/[EPISODE_ID]
   - `generated_at`: 2024-01-20T10:30:00.000Z (current timestamp)

## Step 7: Cleanup

```bash
# Clean up temporary files
rm -f token_response.json
rm -f script_response.json  
rm -f title_response.json
rm -f description_response.json
rm -f tags_response.json
rm -f upload_response.json

# Keep the generated content for reference
echo "Keeping these files:"
ls -la episode_*

# Optional: Archive the episode materials
mkdir -p "episodes/20240120_morning_meditation"
mv episode_* "episodes/20240120_morning_meditation/"
```

## Verification

1. **Check Spreaker**: Visit the episode URL to confirm it's live
2. **Check Audio**: Play the episode to verify quality
3. **Check Metadata**: Confirm title, description, and tags are correct
4. **Check Schedule**: Verify the publish date/time is correct
5. **Check Sheet**: Confirm Google Sheets is updated

## Expected Results

After successful completion:
- ✅ Episode generated with meditation script
- ✅ Audio file created (approximately 5-15 minutes)  
- ✅ Episode uploaded to Spreaker
- ✅ Episode scheduled for 2024-01-20 08:00:00 UTC
- ✅ Google Sheets row marked as generated
- ✅ Spreaker URL accessible

## Troubleshooting This Example

### If OpenAI requests fail:
```bash
# Check API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

# Check quota
# Visit: https://platform.openai.com/usage
```

### If Spreaker auth fails:
```bash
# Regenerate token using oauth-server.js
# Or check Spreaker app settings
```

### If upload fails:
```bash
# Check file size
ls -lh episode_audio.mp3

# Verify audio file integrity  
file episode_audio.mp3

# Try uploading manually via Spreaker dashboard
```

This example demonstrates the complete manual workflow for a single episode. Repeat these steps for each episode you need to process.