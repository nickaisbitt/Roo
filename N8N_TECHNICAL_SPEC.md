# 🎙️ Roo n8n Workflow - Technical Specification

## 📋 Workflow Architecture

### Node Structure and Flow

The Roo n8n workflow consists of 23 interconnected nodes that replicate the complete podcast automation process. Below is the detailed technical specification of each node and their relationships.

## 🔧 Node Specifications

### 1. Weekly Trigger (cron-trigger)
- **Type**: `n8n-nodes-base.cron`
- **Purpose**: Initiates workflow execution on schedule
- **Configuration**:
  - Schedule: Monday at 8:00 AM
  - Timezone: Configurable
- **Output**: Single trigger event

### 2. Initialize Workflow (init-workflow)
- **Type**: `n8n-nodes-base.code`
- **Purpose**: Validates environment and sets configuration
- **Dependencies**: None
- **Validation Checks**:
  - Required environment variables
  - Configuration defaults
  - System initialization
- **Output**: Configuration object with settings

### 3. Read Episode Data (read-google-sheets)
- **Type**: `n8n-nodes-base.googleSheets`
- **Purpose**: Retrieves all episode data from Google Sheets
- **Authentication**: Service Account JSON
- **Configuration**:
  - Document ID: From environment variable
  - Sheet name: From environment variable
  - Operation: Read all rows
- **Output**: Array of episode records

### 4. Filter Episodes (filter-episodes)
- **Type**: `n8n-nodes-base.code`
- **Purpose**: Filters and validates episodes for processing
- **Logic**:
  - Date parsing (DD/MM/YYYY format)
  - Date range validation (1 year past to 6 months future)
  - Generation status checking
  - Episode type detection
- **Output**: Filtered array of candidate episodes

### 5. Episodes Exist? (check-episodes-exist)
- **Type**: `n8n-nodes-base.if`
- **Purpose**: Conditional routing based on episode availability
- **Condition**: `status !== "no_episodes"`
- **True Path**: Continue to content generation
- **False Path**: Route to no-episodes handler

### 6. Prepare Content Generation (prepare-content-generation)
- **Type**: `n8n-nodes-base.code`
- **Purpose**: Sets up episode structure and sections
- **Episode Structures**:
  - **Main Episodes**: 9 sections (Opening, Topic Intro, Deep Dive 1&2, Research, Listener Stories, Practical Tools 1&2, Wrap-up)
  - **Friday Episodes**: 6 sections (Opening, Topic Exploration, Research, Community, Tools, Closing)
- **Output**: Episode with section structure

### 7. Create Section Prompt (create-section-prompt)
- **Type**: `n8n-nodes-base.code`
- **Purpose**: Generates OpenAI prompts for each section
- **Prompt Engineering**:
  - Section-specific instructions
  - Word count targets
  - Contextual flow maintenance
  - Gregory's voice and style
- **Output**: Episode with section prompt

### 8. Generate Section (generate-section)
- **Type**: `n8n-nodes-base.openAi`
- **Purpose**: Generates section content using OpenAI
- **Configuration**:
  - Model: Configurable (default: gpt-4o)
  - Max tokens: Dynamic based on target word count
  - Temperature: 0.7
- **Output**: Generated section content

### 9. Process Section (process-section)
- **Type**: `n8n-nodes-base.code`
- **Purpose**: Processes generated content and manages section loop
- **Logic**:
  - Word count validation
  - Section completion tracking
  - Script assembly
  - Loop continuation logic
- **Output**: Updated episode with section status

### 10. More Sections? (check-more-sections)
- **Type**: `n8n-nodes-base.if`
- **Purpose**: Controls section generation loop
- **Condition**: `contentGenerationStage === "continue"`
- **True Path**: Loop back to section generation
- **False Path**: Continue to final content generation

### 11-14. Content Generation Nodes

#### 11. Generate Title (generate-title)
- **Type**: `n8n-nodes-base.openAi`
- **Purpose**: Creates SEO-optimized episode title
- **Requirements**: 60-70 characters, includes "CPTSD"
- **Configuration**: Max tokens: 64, Temperature: 0.6

#### 12. Generate Description (generate-description)
- **Type**: `n8n-nodes-base.openAi`
- **Purpose**: Creates plain text episode description
- **Requirements**: 450-850 words, bullet format
- **Configuration**: Max tokens: 900, Temperature: 0.7

#### 13. Generate HTML Description (generate-html-description)
- **Type**: `n8n-nodes-base.openAi`
- **Purpose**: Creates HTML-formatted description
- **Requirements**: Spotify-compatible HTML tags only
- **Configuration**: Max tokens: 900, Temperature: 0.7

#### 14. Generate Tags (generate-tags)
- **Type**: `n8n-nodes-base.openAi`
- **Purpose**: Creates SEO tags for episode
- **Requirements**: Exactly 20 single-word, lowercase tags
- **Configuration**: Max tokens: 200, Temperature: 0.4

### 15. Combine Content (combine-content)
- **Type**: `n8n-nodes-base.code`
- **Purpose**: Assembles final episode content
- **Operations**:
  - Script finalization
  - Supporters Club CTA addition
  - Tag sanitization
  - Content validation
- **Output**: Complete episode package

### 16. Generate Audio (generate-audio)
- **Type**: `n8n-nodes-base.openAi`
- **Purpose**: Creates MP3 audio from script
- **Configuration**:
  - Model: tts-1
  - Voice: fable
  - Format: mp3
- **Output**: Binary audio data

### 17. Check Dry Run (check-dry-run)
- **Type**: `n8n-nodes-base.code`
- **Purpose**: Handles dry run mode
- **Logic**:
  - Environment check for DRY_RUN flag
  - Mock upload result generation
  - Logging and simulation
- **Output**: Episode with upload readiness status

### 18. Upload Needed? (check-upload-needed)
- **Type**: `n8n-nodes-base.if`
- **Purpose**: Determines if actual upload is required
- **Condition**: `uploadResult.dryRun !== true`
- **True Path**: Proceed with upload
- **False Path**: Skip to result processing

### 19. Refresh Spreaker Token (refresh-spreaker-token)
- **Type**: `n8n-nodes-base.httpRequest`
- **Purpose**: Refreshes Spreaker OAuth access token
- **Configuration**:
  - Method: POST
  - URL: Spreaker OAuth endpoint
  - Body: refresh_token grant
- **Output**: New access token

### 20. Upload to Spreaker (upload-episode)
- **Type**: `n8n-nodes-base.httpRequest`
- **Purpose**: Uploads episode to Spreaker platform
- **Configuration**:
  - Method: POST
  - Content-Type: multipart/form-data
  - Audio file upload
  - Metadata submission
- **Output**: Spreaker episode response

### 21. Process Upload Result (process-upload-result)
- **Type**: `n8n-nodes-base.code`
- **Purpose**: Processes upload response
- **Operations**:
  - Result validation
  - URL extraction
  - Error handling
  - Status determination
- **Output**: Episode with upload results

### 22. Update Google Sheets (update-google-sheets)
- **Type**: `n8n-nodes-base.googleSheets`
- **Purpose**: Updates episode status in Google Sheets
- **Configuration**:
  - Operation: Update specific row
  - Fields: generated, spreaker_episode_id, spreaker_url, generated_at
- **Output**: Update confirmation

### 23. Workflow Complete (workflow-complete)
- **Type**: `n8n-nodes-base.code`
- **Purpose**: Finalizes workflow and provides summary
- **Operations**:
  - Summary generation
  - Success/failure counting
  - Comprehensive logging
  - Completion notification
- **Output**: Workflow summary

### 24. No Episodes Handler (no-episodes-handler)
- **Type**: `n8n-nodes-base.code`
- **Purpose**: Handles graceful exit when no episodes to process
- **Operations**:
  - Skip reason logging
  - Graceful termination
  - Status reporting
- **Output**: No-episodes status

## 🔄 Data Flow Architecture

### Episode Processing Pipeline

```
Input: Google Sheets Row
    ↓
Filtering & Validation
    ↓
Episode Structure Setup
    ↓
Section Generation Loop:
    ├── Create Prompt
    ├── Generate Content
    ├── Process & Validate
    └── Check Completion
    ↓
Final Content Generation:
    ├── Title (Parallel)
    ├── Description (Parallel)
    ├── HTML Description (Parallel)
    └── Tags (Parallel)
    ↓
Content Assembly & CTA Addition
    ↓
Audio Generation (TTS)
    ↓
Upload Process:
    ├── Token Refresh
    └── Episode Upload
    ↓
Status Update (Google Sheets)
    ↓
Completion Summary
```

### Data Structure Evolution

#### 1. Initial Episode Object
```json
{
  "_rowIndex": 2,
  "_topic": "Morning Meditation",
  "_type": "friday",
  "_parsedDate": "2024-01-15T00:00:00.000Z",
  "_inputString": "15/01/2024 Friday Healing **Morning Meditation** Morning Meditation"
}
```

#### 2. Content Generation Stage
```json
{
  "sections": [...],
  "currentSection": 0,
  "completedSections": [],
  "combinedScript": "",
  "contentGenerationStage": "ready"
}
```

#### 3. Complete Episode Package
```json
{
  "generatedContent": {
    "script": "Welcome to CPTSD...",
    "title": "CPTSD Friday Healing: Morning Meditation for Stress Relief",
    "description": "Join Gregory for a gentle...",
    "htmlDescription": "<p>Join Gregory...</p>",
    "tags": "cptsd,meditation,healing,stress,relief,mindfulness,trauma,recovery"
  }
}
```

#### 4. Upload Result
```json
{
  "uploadResult": {
    "success": true,
    "episodeId": "123456",
    "episodeUrl": "https://spreaker.com/episode/123456",
    "dryRun": false
  }
}
```

## 🔗 Node Connections

### Primary Flow Connections
1. `Weekly Trigger` → `Initialize Workflow`
2. `Initialize Workflow` → `Read Episode Data`
3. `Read Episode Data` → `Filter Episodes`
4. `Filter Episodes` → `Episodes Exist?`
5. `Episodes Exist?` → `Prepare Content Generation` (true) / `No Episodes Handler` (false)

### Content Generation Loop
6. `Prepare Content Generation` → `Create Section Prompt`
7. `Create Section Prompt` → `Generate Section`
8. `Generate Section` → `Process Section`
9. `Process Section` → `More Sections?`
10. `More Sections?` → `Create Section Prompt` (loop) / Parallel content generation (exit)

### Parallel Content Generation
11. `More Sections?` → `Generate Title` (parallel)
12. `More Sections?` → `Generate Description` (parallel)
13. `More Sections?` → `Generate HTML Description` (parallel)
14. `More Sections?` → `Generate Tags` (parallel)
15. All parallel nodes → `Combine Content` (merge)

### Upload Pipeline
16. `Combine Content` → `Generate Audio`
17. `Generate Audio` → `Check Dry Run`
18. `Check Dry Run` → `Upload Needed?`
19. `Upload Needed?` → `Refresh Spreaker Token` (true) / `Process Upload Result` (false)
20. `Refresh Spreaker Token` → `Upload to Spreaker`
21. `Upload to Spreaker` → `Process Upload Result`

### Finalization
22. `Process Upload Result` → `Update Google Sheets`
23. `Update Google Sheets` → `Workflow Complete`

## ⚙️ Configuration Parameters

### Environment Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | String | Yes | - | Google Sheets document ID |
| `GOOGLE_SHEETS_TAB_NAME` | String | Yes | - | Sheet tab name |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON | Yes | - | Service account credentials |
| `OPENAI_API_KEY` | String | Yes | - | OpenAI API key |
| `OPENAI_TEXT_MODEL` | String | No | gpt-4o | OpenAI model for text generation |
| `SPREAKER_CLIENT_ID` | String | Yes | - | Spreaker app client ID |
| `SPREAKER_CLIENT_SECRET` | String | Yes | - | Spreaker app client secret |
| `SPREAKER_REFRESH_TOKEN` | String | Yes | - | Current Spreaker refresh token |
| `SPREAKER_SHOW_ID` | String | Yes | - | Spreaker podcast show ID |
| `SPREAKER_PUBLISH_TIME_UTC` | String | No | 08:00:00 | Default episode publish time |
| `EPISODE_TIMEZONE` | String | No | UTC | Timezone for date parsing |
| `MAX_EPISODES_PER_RUN` | Number | No | 2 | Episodes to process per execution |
| `DRY_RUN` | Boolean | No | false | Enable dry run mode |

### Content Generation Settings

#### Episode Structures
- **Main Episodes**: 9 sections, ~9,000 words total
- **Friday Episodes**: 6 sections, ~3,200 words total

#### OpenAI Parameters
- **Text Model**: gpt-4o (configurable)
- **Temperature**: 0.7 (sections), 0.6 (title), 0.4 (tags)
- **Max Tokens**: Dynamic based on word targets
- **TTS Model**: tts-1 with fable voice

#### Upload Configuration
- **Audio Format**: MP3
- **Publish Time**: Configurable UTC time
- **Download Enabled**: True
- **Auto-publish**: Based on publish date

## 🔍 Error Handling

### Node-Level Error Handling
- **Retry Logic**: Built into HTTP request nodes
- **Validation**: Input validation in code nodes
- **Graceful Degradation**: Fallback paths for failures

### Workflow-Level Error Handling
- **Execution Logs**: All steps logged for debugging
- **Conditional Routing**: Error paths for common failures
- **State Management**: Consistent data flow between nodes

### Recovery Mechanisms
- **Partial Completion**: Track progress through Google Sheets
- **Manual Intervention**: Clear failure points for manual fixes
- **Restart Capability**: Resume from last successful step

## 📊 Performance Characteristics

### Execution Times
- **Total Workflow**: 10-15 minutes for 2 episodes
- **Content Generation**: 3-5 minutes per episode
- **Audio Generation**: 1-2 minutes per episode
- **Upload Process**: 1-2 minutes per episode

### Resource Requirements
- **Memory**: Moderate (audio processing)
- **CPU**: High during content generation
- **Network**: High during uploads
- **Storage**: Minimal (temporary files)

### Scalability Factors
- **API Rate Limits**: OpenAI and Spreaker constraints
- **Parallel Processing**: Episodes can be processed in parallel
- **Queue Management**: Batch size configurable

## 🔒 Security Considerations

### Credential Management
- **API Keys**: Stored in n8n credentials manager
- **Service Accounts**: JSON stored as environment variable
- **Token Rotation**: Automatic Spreaker token refresh

### Data Protection
- **Temporary Files**: Audio files cleaned up after upload
- **Audit Trail**: All executions logged
- **Access Control**: n8n user permissions

### API Security
- **HTTPS Only**: All API calls use secure connections
- **Token Expiration**: Automatic refresh handling
- **Rate Limiting**: Respect API quotas

---

*This technical specification provides the complete architectural blueprint for the Roo n8n workflow, enabling full understanding, maintenance, and enhancement of the automation system.*