# 🎙️ Complete Roo Podcast Automation Process Guide

## 📖 Table of Contents
1. [Overview & Purpose](#overview--purpose)
2. [Prerequisites & Setup](#prerequisites--setup)
3. [Episode Selection Criteria](#episode-selection-criteria)
4. [Google Sheets Structure & Requirements](#google-sheets-structure--requirements)
5. [Step-by-Step Manual Process](#step-by-step-manual-process)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Verification & Quality Control](#verification--quality-control)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Common Gotchas & Edge Cases](#common-gotchas--edge-cases)
10. [Emergency Procedures](#emergency-procedures)

---

## Overview & Purpose

This guide provides **impeccably detailed** instructions for manually executing the complete Roo podcast automation workflow. This document is designed for a **completely new person** to take over the process and execute it successfully without prior knowledge.

### What This Process Does
The Roo system automates the creation and publication of podcast episodes through this workflow:
```
Google Sheets → Content Generation → Audio Creation → Upload → Tracking Update
     ↓               ↓                    ↓             ↓           ↓
  Read episode    Generate with         Create MP3    Upload to   Mark as
  metadata &      OpenAI (GPT-4o):     using OpenAI  Spreaker    complete &
  topics          • Script              TTS with      with all    update URLs
                  • Title               'fable'       metadata
                  • Description         voice
                  • Tags

```

### When to Use This Guide
- **Automation is broken** and needs manual intervention
- **Learning the process** to understand what the system does
- **Emergency situations** requiring immediate episode publication
- **Troubleshooting** automation failures
- **Taking over** from someone else who previously managed this

---

## Prerequisites & Setup

### Required Accounts & Access
You must have access to all of the following before starting:

#### 1. Google Sheets Access
- **Access to the podcast episode tracking spreadsheet**
- **Permissions**: Must be able to read and write to the sheet
- **Sheet ID**: You'll need the Google Sheets document ID (found in the URL)
- **Tab Name**: Know which tab/sheet contains the episode data (e.g., "Episodes")

#### 2. OpenAI Account & API Access
- **OpenAI API Key** with sufficient credits
- **Access to GPT-4o model** for content generation
- **Access to TTS models** (gpt-4o-mini-tts with 'fable' voice)
- **Sufficient quota** for both text generation and audio synthesis

#### 3. Spreaker Account & API Access
- **Spreaker account** with podcast show access
- **OAuth application** set up in Spreaker
- **Client ID and Client Secret** from your Spreaker app
- **Valid refresh token** (this expires and needs regeneration)
- **Show ID** for your podcast

#### 4. Required Tools
On your computer, you need:
- **curl** - For making API requests
- **jq** (optional but recommended) - For parsing JSON responses
- **ffmpeg** (if concatenating audio) - For combining multiple audio files
- **Text editor** - For editing scripts and viewing content
- **Web browser** - For accessing Google Sheets and Spreaker

### Environment Setup
Create a file with your environment variables or set them in your terminal:

```bash
# Google Sheets Configuration
export GOOGLE_SHEETS_SPREADSHEET_ID="your-spreadsheet-id-here"
export GOOGLE_SHEETS_TAB_NAME="Episodes"  # or your tab name
export GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'  # Full JSON

# OpenAI Configuration  
export OPENAI_API_KEY="sk-your-openai-api-key-here"
export OPENAI_TEXT_MODEL="gpt-4o"  # Optional, defaults to gpt-4o

# Spreaker Configuration
export SPREAKER_CLIENT_ID="12345"  # Your Spreaker app client ID
export SPREAKER_CLIENT_SECRET="your-client-secret-here"
export SPREAKER_REFRESH_TOKEN="your-current-refresh-token"
export SPREAKER_SHOW_ID="987654"  # Your podcast show ID
export SPREAKER_PUBLISH_TIME_UTC="08:00:00"  # Default publish time

# Optional Configuration
export EPISODE_TIMEZONE="UTC"  # or your timezone
export MAX_EPISODES_PER_RUN="2"  # How many to process at once
```

---

## Episode Selection Criteria

### **CRITICAL: Exact Date Range Requirements**

The system will **ONLY** process episodes that meet **ALL** of these criteria:

#### 1. **Date Range: 365 Days Back to 180 Days Forward**
- **From**: 365 days before today
- **To**: 180 days from today ⚠️ **Note**: While you mentioned "next 63 days", the current system uses 180 days forward
- **Example**: If today is January 15, 2024:
  - **Earliest date**: January 15, 2023 (365 days ago)
  - **Latest date**: July 13, 2024 (180 days forward)

**🔧 Configuration Note**: The 180-day forward window is currently hardcoded in `src/index.js` line 832. To change this to 63 days as you mentioned, you would need to modify the code from `withinNextNDays(parseResult.date,180)` to `withinNextNDays(parseResult.date,63)`.

#### 2. **Generated Status: Must NOT Be Generated**
Episodes are processed **ONLY** if the "generated" column is:
- **Empty** (blank cell)
- **FALSE** (explicit false value)
- **NO** 
- **0** (zero)

Episodes are **SKIPPED** if the "generated" column contains:
- **TRUE** (any case: true, True, TRUE)
- **YES** (any case: yes, Yes, YES)  
- **1** (the number one)

#### 3. **Must Have Valid Topic/Title**
- The topic field cannot be empty
- Must contain actual episode content description

#### 4. **Must Have Valid Date Format**
- Date must be in **DD/MM/YYYY** format (e.g., "15/01/2024")
- Date must be parseable and valid

### How to Identify Episodes for Processing

#### Step 1: Open Your Google Sheet
1. **Navigate** to your Google Sheets document
2. **Open the correct tab** (usually named "Episodes" or similar)
3. **Look for these column headers**:
   - Date column: `publish_date`, `date`, `episode date`, or `publish`
   - Topic column: `topic`, `title`, `episode topic`, or `episode title`
   - Type column: `type`, `episode_type`, or `episode type`
   - Generated column: `generated`

#### Step 2: Filter for Target Episodes
Look for rows where:
1. **Date is within range** (check manually or use sheet filters)
2. **Generated column is empty or FALSE**
3. **Topic column has content**
4. **Type is specified** ("main" or "friday" typically)

#### Step 3: Note Episode Details
For each episode you'll process, record:
- **Row number** (for tracking)
- **Publish date** (DD/MM/YYYY format)
- **Topic/title** (exact text)
- **Episode type** (main/friday/etc.)
- **Any additional metadata**

---

## Google Sheets Structure & Requirements

### Required Columns
Your Google Sheet **MUST** have these columns (names can vary):

#### Date Column (ONE of these names):
- `publish_date` (preferred)
- `date`
- `episode date`
- `publish`
- **Format**: DD/MM/YYYY (e.g., "15/01/2024")
- **Required**: Yes, must be valid date

#### Topic Column (ONE of these names):
- `topic` (preferred)
- `title`
- `episode topic`  
- `episode title`
- **Format**: Free text describing the episode
- **Required**: Yes, cannot be empty

#### Type Column (ONE of these names):
- `type` (preferred)
- `episode_type`
- `episode type`
- **Format**: Usually "main" or "friday"
- **Required**: Yes for proper content generation

#### Generated Status Column:
- `generated` (exact name required)
- **Format**: TRUE/FALSE, YES/NO, 1/0, or empty
- **Purpose**: Tracks which episodes have been processed

#### Tracking Columns (Auto-populated):
- `spreaker_episode_id` - Populated after upload
- `spreaker_url` - Populated after upload  
- `generated_at` - Timestamp when completed

### Example Sheet Structure
```
| Row | publish_date | topic                           | type   | generated | spreaker_episode_id | spreaker_url                               | generated_at              |
|-----|-------------|----------------------------------|--------|-----------|--------------------|--------------------------------------------|---------------------------|
| 1   | 15/01/2024  | Morning Meditation for Anxiety   | friday | FALSE     |                    |                                            |                           |
| 2   | 16/01/2024  | Dealing with Work Stress         | main   |           |                    |                                            |                           |
| 3   | 17/01/2024  | Evening Relaxation Practice      | friday | TRUE      | 12345678           | https://www.spreaker.com/episode/12345678 | 2024-01-17T10:30:00.000Z |
```

### Column Requirements Checklist
Before processing any episodes, verify:
- [ ] **Date column exists** with proper DD/MM/YYYY format
- [ ] **Topic column exists** with episode descriptions
- [ ] **Type column exists** with episode types
- [ ] **Generated column exists** for tracking status
- [ ] **Dates are within 365 days ago to 180 days forward**
- [ ] **Target episodes have generated = FALSE or empty**
- [ ] **You have edit permissions** on the sheet

---

## Step-by-Step Manual Process

### Phase 1: Preparation and Authentication

#### Step 1.1: Set Up Your Working Directory
```bash
# Create a working directory for this session
mkdir -p ~/podcast_manual_$(date +%Y%m%d)
cd ~/podcast_manual_$(date +%Y%m%d)

# Create subdirectories for organization
mkdir -p content audio responses temp
```

#### Step 1.2: Test OpenAI API Connection
```bash
# Test your OpenAI API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models \
     -s | head -50

# Expected: JSON response with model list
# If error: Check API key and account status
```

#### Step 1.3: Generate Spreaker Access Token
```bash
# Get fresh access token from refresh token
curl -X POST https://api.spreaker.com/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "client_id=$SPREAKER_CLIENT_ID" \
  -d "client_secret=$SPREAKER_CLIENT_SECRET" \
  -d "refresh_token=$SPREAKER_REFRESH_TOKEN" \
  -o temp/token_response.json

# Check if successful
if [ $? -eq 0 ]; then
    echo "✅ Token refresh successful"
    cat temp/token_response.json
else
    echo "❌ Token refresh failed - check your credentials"
    exit 1
fi

# Extract access token
ACCESS_TOKEN=$(cat temp/token_response.json | jq -r '.access_token')
echo "Access Token: $ACCESS_TOKEN"

# Check for new refresh token
NEW_REFRESH_TOKEN=$(cat temp/token_response.json | jq -r '.refresh_token')
if [ "$NEW_REFRESH_TOKEN" != "null" ] && [ "$NEW_REFRESH_TOKEN" != "$SPREAKER_REFRESH_TOKEN" ]; then
    echo "🔄 NEW REFRESH TOKEN RECEIVED: $NEW_REFRESH_TOKEN"
    echo "⚠️  IMPORTANT: Update your SPREAKER_REFRESH_TOKEN environment variable!"
    export SPREAKER_REFRESH_TOKEN="$NEW_REFRESH_TOKEN"
fi
```

#### Step 1.4: Verify Spreaker Show Access
```bash
# Test access to your show
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
     "https://api.spreaker.com/v2/shows/$SPREAKER_SHOW_ID" \
     -o temp/show_info.json

# Check response
if grep -q '"response"' temp/show_info.json; then
    echo "✅ Show access confirmed"
    echo "Show title: $(cat temp/show_info.json | jq -r '.response.show.title')"
else
    echo "❌ Cannot access show - check SPREAKER_SHOW_ID"
    cat temp/show_info.json
    exit 1
fi
```

### Phase 2: Episode Selection and Content Generation

#### Step 2.1: Manually Identify Target Episodes
1. **Open your Google Sheet** in a web browser
2. **Navigate to the correct tab** (check GOOGLE_SHEETS_TAB_NAME)
3. **Review the date range**: Look for episodes between:
   - **Start date**: 365 days ago from today
   - **End date**: 180 days from today
4. **Filter for unprocessed episodes**:
   - Find rows where `generated` column is empty or FALSE
   - Exclude rows where `generated` is TRUE, YES, or 1
5. **Record episode details** for processing:

```bash
# Create episode tracking file
cat > episode_list.txt << 'EOF'
# Episode processing list - update with your episodes
# Format: ROW_NUMBER|DATE|TOPIC|TYPE
# Example:
# 15|20/01/2024|Morning Meditation for Stress Relief|friday
# 16|21/01/2024|Dealing with Workplace Anxiety|main
EOF

# Edit this file with your actual episodes
nano episode_list.txt
```

#### Step 2.2: Process Each Episode
For each episode in your list, follow these detailed steps:

##### Step 2.2.1: Set Episode Variables
```bash
# Set variables for current episode (UPDATE THESE FOR EACH EPISODE)
EPISODE_ROW="15"  # Row number from Google Sheets
EPISODE_DATE="20/01/2024"  # DD/MM/YYYY format
EPISODE_TOPIC="Morning Meditation for Stress Relief"  # Exact topic from sheet
EPISODE_TYPE="friday"  # main or friday typically
PUBLISH_DATETIME="2024-01-20 08:00:00"  # Convert to YYYY-MM-DD HH:MM:SS

echo "Processing Episode:"
echo "  Row: $EPISODE_ROW"
echo "  Date: $EPISODE_DATE"
echo "  Topic: $EPISODE_TOPIC"
echo "  Type: $EPISODE_TYPE"
echo "  Publish: $PUBLISH_DATETIME"
```

##### Step 2.2.2: Generate Episode Script
```bash
# Generate main script content
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"gpt-4o\",
    \"messages\": [
      {
        \"role\": \"system\",
        \"content\": \"You are a skilled podcast script writer. For 'friday' episodes, create healing and meditation focused content with a calm, soothing tone. For 'main' episodes, create engaging conversational content. Include a natural introduction, main content, and gentle conclusion.\"
      },
      {
        \"role\": \"user\",
        \"content\": \"Create a $EPISODE_TYPE podcast script about: $EPISODE_TOPIC. Date: $EPISODE_DATE. Make it engaging and appropriate for the episode type.\"
      }
    ],
    \"max_tokens\": 1500,
    \"temperature\": 0.7
  }" \
  -o "responses/script_row${EPISODE_ROW}.json"

# Extract script content
cat "responses/script_row${EPISODE_ROW}.json" | jq -r '.choices[0].message.content' > "content/script_row${EPISODE_ROW}.txt"

# Verify script was generated
if [ -s "content/script_row${EPISODE_ROW}.txt" ]; then
    echo "✅ Script generated ($(wc -w < content/script_row${EPISODE_ROW}.txt) words)"
    echo "Preview: $(head -c 200 content/script_row${EPISODE_ROW}.txt)..."
else
    echo "❌ Script generation failed"
    cat "responses/script_row${EPISODE_ROW}.json"
    exit 1
fi
```

##### Step 2.2.3: Generate Episode Title
```bash
# Generate episode title
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"gpt-4o\",
    \"messages\": [
      {
        \"role\": \"system\",
        \"content\": \"You are a podcast title creator. Create compelling, SEO-friendly titles that are concise and engaging. For healing/meditation content, emphasize wellness and peace. For main episodes, focus on the core topic and benefit.\"
      },
      {
        \"role\": \"user\",
        \"content\": \"Create a compelling title for a $EPISODE_TYPE podcast episode about: $EPISODE_TOPIC\"
      }
    ],
    \"max_tokens\": 100,
    \"temperature\": 0.6
  }" \
  -o "responses/title_row${EPISODE_ROW}.json"

# Extract title and clean it
cat "responses/title_row${EPISODE_ROW}.json" | jq -r '.choices[0].message.content' | sed 's/^"//;s/"$//' > "content/title_row${EPISODE_ROW}.txt"

EPISODE_TITLE=$(cat "content/title_row${EPISODE_ROW}.txt")
echo "✅ Title generated: $EPISODE_TITLE"
```

##### Step 2.2.4: Generate Episode Description (HTML)
```bash
# Generate HTML description
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"gpt-4o\",
    \"messages\": [
      {
        \"role\": \"system\",
        \"content\": \"You are a podcast description writer. Create engaging HTML-formatted descriptions using paragraph tags. Include key benefits and what listeners will gain. Make it compelling for potential listeners and SEO-friendly.\"
      },
      {
        \"role\": \"user\",
        \"content\": \"Create an HTML description for a $EPISODE_TYPE podcast episode titled '$EPISODE_TITLE' about: $EPISODE_TOPIC\"
      }
    ],
    \"max_tokens\": 400,
    \"temperature\": 0.7
  }" \
  -o "responses/description_row${EPISODE_ROW}.json"

# Extract description
cat "responses/description_row${EPISODE_ROW}.json" | jq -r '.choices[0].message.content' > "content/description_row${EPISODE_ROW}.html"

echo "✅ Description generated:"
head -200 "content/description_row${EPISODE_ROW}.html"
```

##### Step 2.2.5: Generate Episode Tags
```bash
# Generate tags
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"gpt-4o\",
    \"messages\": [
      {
        \"role\": \"system\",
        \"content\": \"You are a podcast tag generator. Create relevant, SEO-friendly tags separated by commas. Focus on topics, emotions, benefits, and searchable terms. Limit to 8-10 tags maximum.\"
      },
      {
        \"role\": \"user\",
        \"content\": \"Create tags for a $EPISODE_TYPE podcast episode about: $EPISODE_TOPIC\"
      }
    ],
    \"max_tokens\": 100,
    \"temperature\": 0.4
  }" \
  -o "responses/tags_row${EPISODE_ROW}.json"

# Extract tags and clean them
cat "responses/tags_row${EPISODE_ROW}.json" | jq -r '.choices[0].message.content' | sed 's/^"//;s/"$//' > "content/tags_row${EPISODE_ROW}.txt"

EPISODE_TAGS=$(cat "content/tags_row${EPISODE_ROW}.txt")
echo "✅ Tags generated: $EPISODE_TAGS"
```

### Phase 3: Audio Generation

#### Step 3.1: Check Script Length for TTS
```bash
# Check script character count
SCRIPT_LENGTH=$(wc -c < "content/script_row${EPISODE_ROW}.txt")
echo "Script length: $SCRIPT_LENGTH characters"

if [ $SCRIPT_LENGTH -gt 3500 ]; then
    echo "⚠️  Script is too long for single TTS request ($SCRIPT_LENGTH > 3500 chars)"
    echo "Script needs to be split into chunks"
    
    # Split script into chunks (basic approach)
    split -C 3400 "content/script_row${EPISODE_ROW}.txt" "content/script_row${EPISODE_ROW}_chunk_"
    
    echo "Script split into chunks:"
    ls -la content/script_row${EPISODE_ROW}_chunk_*
    
    # You'll need to process each chunk separately (see troubleshooting section)
else
    echo "✅ Script length OK for single TTS request"
fi
```

#### Step 3.2: Generate Audio with TTS
```bash
# Generate audio using OpenAI TTS
echo "Generating audio with TTS..."

# Read script content and escape for JSON
SCRIPT_CONTENT=$(cat "content/script_row${EPISODE_ROW}.txt" | sed 's/"/\\"/g' | tr '\n' ' ')

curl -X POST https://api.openai.com/v1/audio/speech \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"gpt-4o-mini-tts\",
    \"input\": \"$SCRIPT_CONTENT\",
    \"voice\": \"fable\",
    \"format\": \"mp3\"
  }" \
  --output "audio/episode_row${EPISODE_ROW}.mp3"

# Verify audio file was created
if [ -f "audio/episode_row${EPISODE_ROW}.mp3" ]; then
    AUDIO_SIZE=$(ls -lh "audio/episode_row${EPISODE_ROW}.mp3" | awk '{print $5}')
    echo "✅ Audio generated: $AUDIO_SIZE"
    
    # Basic audio file verification
    file "audio/episode_row${EPISODE_ROW}.mp3"
else
    echo "❌ Audio generation failed"
    exit 1
fi
```

### Phase 4: Upload to Spreaker

#### Step 4.1: Prepare Upload Data
```bash
# Prepare all upload data
EPISODE_TITLE=$(cat "content/title_row${EPISODE_ROW}.txt")
EPISODE_DESCRIPTION=$(cat "content/description_row${EPISODE_ROW}.html")
EPISODE_TAGS=$(cat "content/tags_row${EPISODE_ROW}.txt")
AUDIO_FILE="audio/episode_row${EPISODE_ROW}.mp3"

echo "Upload preparation:"
echo "  Title: $EPISODE_TITLE"
echo "  Tags: $EPISODE_TAGS"
echo "  Audio: $AUDIO_FILE ($(ls -lh $AUDIO_FILE | awk '{print $5}'))"
echo "  Publish: $PUBLISH_DATETIME"
```

#### Step 4.2: Upload Episode to Spreaker
```bash
# Upload episode
echo "Uploading to Spreaker..."

curl -X POST "https://api.spreaker.com/v2/shows/$SPREAKER_SHOW_ID/episodes" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "media_file=@$AUDIO_FILE" \
  -F "title=$EPISODE_TITLE" \
  -F "description=$EPISODE_DESCRIPTION" \
  -F "tags=$EPISODE_TAGS" \
  -F "published_at=$PUBLISH_DATETIME" \
  -o "responses/upload_row${EPISODE_ROW}.json"

# Check upload result
if grep -q '"response"' "responses/upload_row${EPISODE_ROW}.json"; then
    echo "✅ Upload successful!"
    
    # Extract episode details
    SPREAKER_EPISODE_ID=$(cat "responses/upload_row${EPISODE_ROW}.json" | jq -r '.response.episode.episode_id')
    SPREAKER_URL="https://www.spreaker.com/episode/$SPREAKER_EPISODE_ID"
    UPLOAD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
    
    echo "Episode Details:"
    echo "  Spreaker ID: $SPREAKER_EPISODE_ID"
    echo "  URL: $SPREAKER_URL"
    echo "  Uploaded: $UPLOAD_TIMESTAMP"
    
    # Save details for sheet update
    cat > "temp/episode_${EPISODE_ROW}_details.txt" << EOF
ROW: $EPISODE_ROW
SPREAKER_ID: $SPREAKER_EPISODE_ID
SPREAKER_URL: $SPREAKER_URL
GENERATED_AT: $UPLOAD_TIMESTAMP
TITLE: $EPISODE_TITLE
EOF
    
else
    echo "❌ Upload failed!"
    echo "Response:"
    cat "responses/upload_row${EPISODE_ROW}.json"
    exit 1
fi
```

### Phase 5: Update Google Sheets

#### Step 5.1: Manual Google Sheets Update
Since updating Google Sheets programmatically requires complex authentication, **manually update** your sheet:

1. **Open your Google Sheet** in web browser
2. **Navigate to row $EPISODE_ROW**
3. **Update these columns exactly**:

```
Column 'generated': TRUE
Column 'spreaker_episode_id': [SPREAKER_EPISODE_ID from above]
Column 'spreaker_url': [SPREAKER_URL from above]  
Column 'generated_at': [UPLOAD_TIMESTAMP from above]
```

**Example for Row 15:**
- `generated`: TRUE  
- `spreaker_episode_id`: 12345678
- `spreaker_url`: https://www.spreaker.com/episode/12345678
- `generated_at`: 2024-01-20T10:30:00.000Z

#### Step 5.2: Verify Sheet Updates
1. **Refresh the sheet** to ensure changes saved
2. **Check the row is marked** as generated
3. **Test the Spreaker URL** to confirm it works
4. **Verify the episode** is live on Spreaker

### Phase 6: Final Verification

#### Step 6.1: Complete Episode Verification Checklist
For each processed episode, verify:

- [ ] **Script generated** and saved
- [ ] **Title is compelling** and appropriate
- [ ] **Description is HTML formatted** and engaging
- [ ] **Tags are relevant** and SEO-friendly
- [ ] **Audio file exists** and plays correctly
- [ ] **Episode uploaded** to Spreaker successfully
- [ ] **Spreaker URL is live** and accessible
- [ ] **Google Sheet updated** with all tracking info
- [ ] **Episode appears** in your podcast feed
- [ ] **Publish date/time** is correct

#### Step 6.2: Save Processing Summary
```bash
# Create summary file
cat > "episode_${EPISODE_ROW}_summary.txt" << EOF
EPISODE PROCESSING SUMMARY
========================
Row: $EPISODE_ROW
Date: $EPISODE_DATE
Topic: $EPISODE_TOPIC
Type: $EPISODE_TYPE
Title: $EPISODE_TITLE
Spreaker ID: $SPREAKER_EPISODE_ID
Spreaker URL: $SPREAKER_URL
Generated At: $UPLOAD_TIMESTAMP
Status: COMPLETED

Files Created:
- content/script_row${EPISODE_ROW}.txt
- content/title_row${EPISODE_ROW}.txt  
- content/description_row${EPISODE_ROW}.html
- content/tags_row${EPISODE_ROW}.txt
- audio/episode_row${EPISODE_ROW}.mp3

Google Sheet Updates Required:
- Row $EPISODE_ROW: generated = TRUE
- Row $EPISODE_ROW: spreaker_episode_id = $SPREAKER_EPISODE_ID
- Row $EPISODE_ROW: spreaker_url = $SPREAKER_URL
- Row $EPISODE_ROW: generated_at = $UPLOAD_TIMESTAMP
EOF

echo "✅ Episode $EPISODE_ROW processing complete!"
echo "Summary saved to: episode_${EPISODE_ROW}_summary.txt"
```

---

## Environment Variables Reference

### Required Variables
| Variable | Purpose | Example | Notes |
|----------|---------|---------|-------|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Sheet ID from URL | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms` | Found in Google Sheets URL |
| `GOOGLE_SHEETS_TAB_NAME` | Tab/sheet name | `Episodes` | Case sensitive |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Auth credentials | `{"type":"service_account"...}` | Full JSON object |
| `OPENAI_API_KEY` | OpenAI API access | `sk-proj-abc123...` | Must have GPT-4o and TTS access |
| `SPREAKER_CLIENT_ID` | OAuth client ID | `12345` | From Spreaker app settings |
| `SPREAKER_CLIENT_SECRET` | OAuth client secret | `abc123secret` | From Spreaker app settings |
| `SPREAKER_REFRESH_TOKEN` | Current refresh token | `def456refresh` | Expires, needs regeneration |
| `SPREAKER_SHOW_ID` | Podcast show ID | `987654` | From Spreaker show URL |

### Optional Variables
| Variable | Purpose | Default | Notes |
|----------|---------|---------|-------|
| `OPENAI_TEXT_MODEL` | Text generation model | `gpt-4o` | Can use gpt-4, gpt-3.5-turbo |
| `SPREAKER_PUBLISH_TIME_UTC` | Default publish time | `08:00:00` | 24-hour format UTC |
| `EPISODE_TIMEZONE` | Episode timezone | `UTC` | For date calculations |
| `MAX_EPISODES_PER_RUN` | Batch size limit | `2` | How many to process |

---

## Verification & Quality Control

### Content Quality Checklist
For each generated piece of content, verify:

#### Script Quality
- [ ] **Appropriate length** (not too short/long for episode type)
- [ ] **Proper tone** (healing for friday, conversational for main)
- [ ] **Clear structure** (intro, main content, conclusion)
- [ ] **No placeholder text** or obvious AI artifacts
- [ ] **Relevant to topic** and episode type
- [ ] **Flows naturally** when read aloud

#### Title Quality  
- [ ] **Compelling and clickable**
- [ ] **SEO-friendly** with relevant keywords
- [ ] **Appropriate length** (not too long for platforms)
- [ ] **Matches episode content**
- [ ] **No quotes or special characters** that might break

#### Description Quality
- [ ] **Proper HTML formatting** with `<p>` tags
- [ ] **Engaging hook** in first sentence
- [ ] **Clear benefits** for listeners
- [ ] **Call-to-action** if appropriate
- [ ] **No broken HTML** tags
- [ ] **Reasonable length** (not too short/long)

#### Tags Quality
- [ ] **Relevant to content** and searchable
- [ ] **Comma-separated** format
- [ ] **8-10 tags maximum**
- [ ] **Mix of broad and specific** terms
- [ ] **No special characters** that might break
- [ ] **SEO-friendly** keywords included

#### Audio Quality
- [ ] **File exists and is not corrupted**
- [ ] **Reasonable file size** (not empty, not too large)
- [ ] **Proper MP3 format**
- [ ] **Audio plays correctly** (test with audio player)
- [ ] **Voice is clear** and appropriate (fable voice)
- [ ] **No obvious audio artifacts** or cuts

#### Upload Quality
- [ ] **Episode appears on Spreaker**
- [ ] **Title matches** generated content
- [ ] **Description displays properly** with HTML formatting
- [ ] **Tags are applied** correctly
- [ ] **Publish date/time** is correct
- [ ] **Audio plays** in podcast players
- [ ] **Episode is public** and discoverable

### Technical Verification
- [ ] **All API calls returned success** (200 status codes)
- [ ] **No error messages** in response files
- [ ] **File sizes are reasonable**:
  - Script: 1KB - 50KB typically
  - Audio: 1MB - 100MB typically  
  - Responses: 1KB - 10KB typically
- [ ] **Spreaker episode ID** is valid number
- [ ] **Spreaker URL** returns live episode page
- [ ] **Google Sheet updates** saved successfully

---

## Troubleshooting Guide

### OpenAI API Issues

#### "Invalid API Key" or 401 Errors
**Problem**: Cannot authenticate with OpenAI API
**Solutions**:
1. **Check API key format**: Must start with `sk-` 
2. **Verify key is active**: Check OpenAI dashboard
3. **Check account status**: Ensure not suspended
4. **Test key directly**:
   ```bash
   curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
   ```

#### "Insufficient Quota" or 429 Errors  
**Problem**: Exceeded API usage limits
**Solutions**:
1. **Check usage**: Visit OpenAI usage dashboard
2. **Add billing**: Add payment method if needed
3. **Wait for reset**: Some limits reset monthly
4. **Reduce requests**: Process fewer episodes

#### "Model Not Found" Errors
**Problem**: Requested model not available
**Solutions**:
1. **Check model name**: Ensure "gpt-4o" is correct
2. **Verify access**: Some models need special access
3. **Try alternative**: Use "gpt-4" or "gpt-3.5-turbo"
4. **Check OpenAI status**: Service might be down

#### TTS Generation Fails
**Problem**: Audio generation returns errors
**Solutions**:
1. **Check script length**: Must be ≤ 3500 characters
2. **Verify voice**: Use "fable" voice specifically
3. **Check special characters**: Remove problematic characters
4. **Split long scripts**:
   ```bash
   # Split script into chunks
   split -C 3400 script.txt chunk_
   # Process each chunk separately
   ```

### Spreaker API Issues

#### "Invalid Grant" or Token Errors
**Problem**: Refresh token is expired or invalid
**Solutions**:
1. **Regenerate token**: Use oauth-server.js helper
2. **Check credentials**: Verify client ID/secret
3. **Update environment**: Use new refresh token immediately
4. **Manual regeneration**: Via Spreaker app settings

#### Upload Failures
**Problem**: Episode upload returns errors
**Solutions**:
1. **Check file size**: Spreaker has limits (~500MB)
2. **Verify audio format**: Must be valid MP3
3. **Check filename**: No special characters
4. **Test file integrity**:
   ```bash
   file episode.mp3  # Should show "MPEG ADTS, layer III"
   ```
5. **Validate metadata**: Check title/description for invalid characters

#### "Show Not Found" Errors
**Problem**: Cannot access specified show
**Solutions**:
1. **Verify show ID**: Check Spreaker dashboard
2. **Check permissions**: Ensure account has access
3. **Test show access**:
   ```bash
   curl -H "Authorization: Bearer $ACCESS_TOKEN" \
        "https://api.spreaker.com/v2/shows/$SPREAKER_SHOW_ID"
   ```

### Google Sheets Issues

#### Cannot Read Sheet Data
**Problem**: Cannot access Google Sheets
**Solutions**:
1. **Check sheet ID**: Verify from URL
2. **Check tab name**: Must match exactly (case sensitive)
3. **Verify permissions**: Service account needs access
4. **Test sheet access**: Try opening in browser
5. **Check credentials**: Verify service account JSON

#### Date Parsing Errors
**Problem**: Dates not recognized correctly
**Solutions**:
1. **Check format**: Must be DD/MM/YYYY (15/01/2024)
2. **Remove extra spaces**: Clean up date cells
3. **Verify valid dates**: No 32/01/2024 etc.
4. **Check timezone**: Set EPISODE_TIMEZONE if needed

#### Missing Columns
**Problem**: Cannot find required columns
**Solutions**:
1. **Check column names**: Must match exactly:
   - publish_date, date, episode date, or publish
   - topic, title, episode topic, or episode title
   - type, episode_type, or episode type
   - generated (exact match)
2. **Check capitalization**: Column names are case sensitive
3. **Add missing columns**: Create if they don't exist

### Audio Quality Issues

#### Audio File is Too Large
**Problem**: Generated audio exceeds size limits
**Solutions**:
1. **Reduce script length**: Trim content
2. **Split into parts**: Create multi-part episodes
3. **Check audio settings**: Verify format/quality

#### Audio Quality is Poor
**Problem**: Generated audio sounds bad
**Solutions**:
1. **Check voice setting**: Ensure using "fable"
2. **Review script**: Remove difficult pronunciations
3. **Test with shorter content**: Verify TTS is working

#### No Audio Generated
**Problem**: TTS request returns empty file
**Solutions**:
1. **Check script content**: Ensure not empty
2. **Remove special characters**: Clean up text
3. **Verify API quota**: Check TTS usage limits
4. **Test with simple text**: Verify TTS is working

### File and Directory Issues

#### Permission Denied Errors
**Problem**: Cannot create/write files
**Solutions**:
1. **Check directory permissions**: Ensure writable
2. **Create directories**: mkdir -p for missing dirs
3. **Check disk space**: Ensure sufficient space

#### Missing Files
**Problem**: Expected files don't exist
**Solutions**:
1. **Check working directory**: Ensure in correct location
2. **Verify file creation**: Check for error messages
3. **Check naming**: Ensure consistent file naming

---

## Common Gotchas & Edge Cases

### Date and Time Issues

#### **Gotcha**: Date Range Confusion
- **Problem**: Not understanding the 365-day back to 180-day forward window
- **Solution**: Calculate exact dates before starting:
  ```bash
  # Calculate date range
  TODAY=$(date +%Y-%m-%d)
  START_DATE=$(date -d "$TODAY - 365 days" +%Y-%m-%d)
  END_DATE=$(date -d "$TODAY + 180 days" +%Y-%m-%d)
  echo "Process episodes between $START_DATE and $END_DATE"
  ```

#### **Gotcha**: Timezone Confusion
- **Problem**: Episode dates in different timezone than expected
- **Solution**: Always set EPISODE_TIMEZONE and convert dates consistently

#### **Gotcha**: Weekend vs Weekday Publishing
- **Problem**: Episodes scheduled for weekends might not publish
- **Solution**: Check Spreaker settings for publishing schedule

### Content Generation Issues

#### **Gotcha**: Script Too Long for TTS
- **Problem**: Scripts over 3500 characters fail TTS
- **Solution**: Always check length first:
  ```bash
  if [ $(wc -c < script.txt) -gt 3500 ]; then
      echo "Script too long - needs splitting"
  fi
  ```

#### **Gotcha**: Special Characters Breaking JSON
- **Problem**: Quotes and special characters in content break API calls
- **Solution**: Properly escape content:
  ```bash
  # Escape quotes and newlines for JSON
  ESCAPED_CONTENT=$(cat script.txt | sed 's/"/\\"/g' | tr '\n' ' ')
  ```

#### **Gotcha**: HTML in Descriptions
- **Problem**: Invalid HTML breaks Spreaker upload
- **Solution**: Validate HTML before upload:
  ```bash
  # Basic HTML validation
  if ! echo "$DESCRIPTION" | grep -q "</p>"; then
      echo "Warning: Description may not have proper HTML"
  fi
  ```

### Authentication Edge Cases

#### **Gotcha**: Token Expiration During Process
- **Problem**: Access token expires while processing multiple episodes
- **Solution**: Refresh token before each episode or check expiration

#### **Gotcha**: New Refresh Token Not Saved
- **Problem**: New refresh token received but not used for next episode
- **Solution**: Always check for and use new refresh tokens immediately

#### **Gotcha**: Multiple Token Refresh Attempts
- **Problem**: Multiple simultaneous requests burn tokens
- **Solution**: Process episodes sequentially, not in parallel

### Google Sheets Edge Cases

#### **Gotcha**: Generated Column Case Sensitivity
- **Problem**: "true" vs "TRUE" vs "True" handling
- **Solution**: The system treats any non-empty truthy value as generated

#### **Gotcha**: Date Format Variations
- **Problem**: Different date formats in same column
- **Solution**: Standardize all dates to DD/MM/YYYY before processing

#### **Gotcha**: Empty Rows
- **Problem**: Blank rows between episodes cause confusion
- **Solution**: Skip empty rows, process only rows with dates

### Upload and Publishing Issues

#### **Gotcha**: Publishing in the Past
- **Problem**: Episode date is in the past, publishes immediately
- **Solution**: Check if immediate publication is intended

#### **Gotcha**: Duplicate Uploads
- **Problem**: Running process twice uploads same episode twice
- **Solution**: Always check "generated" column first

#### **Gotcha**: Partial Processing
- **Problem**: Process fails halfway, some episodes uploaded, some not
- **Solution**: Keep detailed logs and verify Google Sheets before restarting

---

## Emergency Procedures

### If Process Fails During Upload
1. **STOP immediately** - Don't continue uploading
2. **Check what was uploaded**:
   ```bash
   # List recent episodes on Spreaker
   curl -H "Authorization: Bearer $ACCESS_TOKEN" \
        "https://api.spreaker.com/v2/shows/$SPREAKER_SHOW_ID/episodes?limit=10"
   ```
3. **Update Google Sheets** for successful uploads
4. **Note where you stopped** (episode row number)
5. **Fix the issue** causing the failure
6. **Resume from next unprocessed episode**

### If Google Sheets Access Fails
1. **Complete episode processing** anyway (save to local files)
2. **Document all episode details**:
   - Row numbers
   - Spreaker episode IDs  
   - Spreaker URLs
   - Timestamps
3. **Update sheet manually** when access is restored
4. **Verify all episodes** are properly tracked

### If OpenAI API Fails
1. **Check OpenAI status page**: https://status.openai.com/
2. **Try again in 5-10 minutes** (may be temporary)
3. **If quota exceeded**:
   - Stop processing immediately
   - Add billing/credits
   - Resume when quota available
4. **If persistent failures**:
   - Switch to alternative model (gpt-4, gpt-3.5-turbo)
   - Reduce content length
   - Process fewer episodes

### If Spreaker Authentication Fails
1. **Regenerate refresh token immediately**:
   - Use oauth-server.js helper
   - Or Spreaker app settings
2. **Update environment variables**
3. **Test authentication** before resuming
4. **If complete failure**:
   - Generate content locally
   - Upload manually via Spreaker dashboard
   - Update tracking sheets

### If Audio Generation Fails
1. **Check file sizes and content**
2. **Try shorter scripts** to test TTS
3. **If TTS completely broken**:
   - Use alternative TTS service
   - Or record manually
   - Upload audio file to Spreaker manually

### Recovery from Partial Failure
1. **Assess current state**:
   ```bash
   # Check what files exist
   ls -la content/ audio/ responses/
   
   # Check which episodes were uploaded
   grep -l "episode_id" responses/upload_*.json
   ```
2. **Update Google Sheets** for completed episodes
3. **Resume from first unprocessed episode**
4. **Verify no duplicates** before continuing

---

## Final Notes for New Operators

### Before You Start
1. **Read this entire guide** before processing any episodes
2. **Test with one episode first** before batch processing
3. **Have backup plans** for each step
4. **Keep detailed notes** of what you do
5. **Set up monitoring** to catch issues early

### During Processing
1. **Check each step** before moving to the next
2. **Save all responses** for troubleshooting
3. **Update Google Sheets** immediately after successful uploads
4. **Verify each episode** is live before marking complete
5. **Keep track of token usage** and quotas

### After Processing
1. **Verify all episodes** are live and working
2. **Update any changed tokens** in environment variables
3. **Clean up temporary files** but keep important responses
4. **Document any issues** encountered for next time
5. **Monitor episodes** for a few days to catch problems

### Key Success Factors
- **Attention to detail** - Small mistakes can break the entire process
- **Patience** - Don't rush through steps
- **Verification** - Always check results before proceeding
- **Documentation** - Keep notes of what works and what doesn't
- **Backup plans** - Know what to do when things go wrong

This process can seem overwhelming at first, but following these detailed steps systematically will ensure successful episode generation and publication. The key is to take it one step at a time and verify each stage before moving forward.

---

*This guide represents the complete manual workflow for Roo podcast automation. Keep it updated as the system evolves and add any new gotchas or solutions you discover.*