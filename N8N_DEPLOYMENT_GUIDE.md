# 🎙️ Roo Podcast Automation - n8n Deployment Guide

## 📖 Overview

This document provides a comprehensive guide for deploying the Roo podcast automation workflow using n8n. The n8n workflow replicates the complete functionality of the original Node.js application, providing a visual, monitored, and easily maintainable automation solution.

## 🔄 Workflow Description

The n8n workflow implements the complete Roo podcast automation process:

```
Weekly Trigger → Initialize → Read Sheets → Filter Episodes → Generate Content → Create Audio → Upload → Update Sheets → Complete
```

### Detailed Process Flow

1. **Weekly Trigger** - Cron job runs every Monday at 8:00 AM
2. **Initialize Workflow** - Validates environment variables and sets configuration
3. **Read Episode Data** - Fetches all episodes from Google Sheets
4. **Filter Episodes** - Identifies episodes ready for processing (date range, not already generated)
5. **Content Generation Loop** - For each episode:
   - **Prepare Content Generation** - Sets up episode structure (main/friday)
   - **Section Generation Loop** - Generates each section using OpenAI:
     - Creates section-specific prompts
     - Generates content with proper word counts
     - Continues until all sections complete
   - **Final Content Generation** - Creates title, descriptions, and tags
   - **Combine Content** - Assembles final script with Supporters Club CTA
6. **Generate Audio** - Creates MP3 using OpenAI TTS (fable voice)
7. **Upload Process** - Uploads to Spreaker:
   - Refreshes OAuth token
   - Uploads episode with metadata
   - Handles dry run mode
8. **Update Google Sheets** - Marks episodes as generated and adds URLs
9. **Workflow Complete** - Provides summary and logging

## 🚀 Deployment Instructions

### Prerequisites

1. **n8n Instance** - Self-hosted or cloud n8n installation
2. **Required Credentials** - Set up the following credentials in n8n:
   - OpenAI API credentials
   - Google Service Account credentials

### Step 1: Import Workflow

1. In your n8n instance, go to **Workflows**
2. Click **Import from File** or **Import from URL**
3. Upload the `n8n-workflow.json` file from this repository
4. The workflow will be imported with all nodes and connections

### Step 2: Configure Credentials

#### OpenAI Credentials
1. Go to **Credentials** in n8n
2. Create new **OpenAI** credential with ID: `openai-credentials`
3. Add your OpenAI API key (starts with `sk-`)

#### Google Service Account
The workflow uses variables for Google Sheets authentication - no separate credential needed in n8n.

### Step 3: Set Environment Variables

In your n8n environment, configure these variables (accessible as `$vars.VARIABLE_NAME`):

#### Required Variables

```bash
# Google Sheets Configuration
GOOGLE_SHEETS_SPREADSHEET_ID="your-spreadsheet-id-here"
GOOGLE_SHEETS_TAB_NAME="Episodes"  # or your tab name
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'  # Full JSON

# OpenAI Configuration  
OPENAI_API_KEY="sk-your-openai-api-key-here"
OPENAI_TEXT_MODEL="gpt-4o"  # Optional, defaults to gpt-4o

# Spreaker Configuration
SPREAKER_CLIENT_ID="12345"  # Your Spreaker app client ID
SPREAKER_CLIENT_SECRET="your-client-secret-here"
SPREAKER_REFRESH_TOKEN="your-current-refresh-token"
SPREAKER_SHOW_ID="987654"  # Your podcast show ID
SPREAKER_PUBLISH_TIME_UTC="08:00:00"  # Default publish time

# Optional Configuration
EPISODE_TIMEZONE="UTC"  # or your timezone
MAX_EPISODES_PER_RUN="2"  # How many to process at once
DRY_RUN="false"  # Set to "true" for testing without uploads
```

#### Setting Variables in n8n

**For Self-Hosted n8n:**
```bash
# In your environment file or Docker compose
N8N_VARIABLE_GOOGLE_SHEETS_SPREADSHEET_ID="your-id"
N8N_VARIABLE_OPENAI_API_KEY="sk-your-key"
# ... etc for all variables
```

**For n8n Cloud:**
1. Go to **Settings** → **Environment Variables**
2. Add each variable without the `N8N_VARIABLE_` prefix
3. Variables will be accessible as `$vars.VARIABLE_NAME` in workflows

### Step 4: Configure Trigger Schedule

1. Open the **Weekly Trigger** node
2. Modify the cron schedule as needed:
   - Default: Monday at 8:00 AM
   - Adjust timezone in trigger settings
   - Or change to different frequency/time

### Step 5: Test the Workflow

1. **Enable Dry Run Mode**:
   - Set `DRY_RUN="true"` in variables
   - This will generate content but not upload to Spreaker

2. **Manual Test**:
   - Click **Test Workflow** 
   - Monitor execution in real-time
   - Check logs for any errors

3. **Verify Results**:
   - Check Google Sheets for test episodes
   - Confirm content generation works
   - Validate audio generation

### Step 6: Enable Production Mode

1. Set `DRY_RUN="false"` in variables
2. Verify Spreaker credentials are correct
3. Enable the workflow for automatic execution

## 🔧 Configuration Options

### Episode Processing

- **MAX_EPISODES_PER_RUN**: Controls how many episodes to process per execution (default: 2)
- **EPISODE_TIMEZONE**: Timezone for date parsing (default: UTC)
- **DRY_RUN**: When true, generates content but doesn't upload (default: false)

### Content Generation

- **OPENAI_TEXT_MODEL**: OpenAI model for content generation (default: gpt-4o)
- Episode types supported:
  - **main**: Full-length episodes with 9 sections
  - **friday**: Shorter healing episodes with 6 sections

### Audio Generation

- Uses OpenAI TTS with "fable" voice
- Automatically handles scripts longer than 3500 characters
- Outputs MP3 format optimized for podcasting

### Upload Settings

- **SPREAKER_PUBLISH_TIME_UTC**: Default publish time for episodes
- Automatic OAuth token refresh
- Comprehensive error handling and retry logic

## 📊 Monitoring and Logs

### Execution Monitoring

1. **Workflow Executions**: View in n8n dashboard
2. **Real-time Logs**: Monitor during execution
3. **Error Notifications**: Configure via n8n webhook/email settings

### Key Metrics

The workflow logs:
- Episodes processed vs skipped
- Content generation success/failure
- Upload status and URLs
- Token refresh operations
- Overall execution summary

### Log Examples

```
🚀 Starting Roo Podcast Automation Workflow
Configuration: {"MAX_EPISODES":2,"DRY_RUN":false,"TIMEZONE":"UTC"}
Found 5 candidate episodes
Skipped: 0 invalid dates, 2 out of range, 1 already generated, 0 empty dates
Will process: 2 episodes
Processing episode: Morning Meditation for Stress Relief (friday)
Section "Opening & Welcome" completed: 398 words
...
Content generation complete for episode: Morning Meditation for Stress Relief
Title: CPTSD Friday Healing: Morning Meditation for Stress Relief
Upload successful for episode: CPTSD Friday Healing: Morning Meditation for Stress Relief
Episode ID: 123456
Episode URL: https://spreaker.com/episode/123456
🎉 Roo Podcast Automation Workflow Complete!
Processed: 2 episodes
Successful: 2
Failed: 0
```

## 🔐 Security Considerations

### Credentials Management

1. **Never store API keys in workflow nodes** - Use n8n variables/credentials
2. **Rotate tokens regularly** - Especially Spreaker refresh tokens
3. **Use service accounts** - For Google Sheets access with minimal permissions
4. **Monitor API usage** - Set up OpenAI usage alerts

### Data Protection

1. **Sensitive data handling** - Audio files are temporary and cleaned up
2. **Audit trail** - All executions are logged in n8n
3. **Environment isolation** - Use separate n8n instances for prod/test

## 🛠️ Troubleshooting

### Common Issues

#### "Missing required variables" Error
- Check all environment variables are set correctly
- Verify variable names match exactly (case-sensitive)
- Ensure Google Service Account JSON is valid

#### OpenAI API Errors
- Verify API key is valid and has sufficient credits
- Check model availability (gpt-4o access)
- Monitor rate limits and quotas

#### Spreaker Upload Failures
- Regenerate refresh token if expired
- Verify client ID and secret are correct
- Check show ID permissions

#### Google Sheets Access Issues
- Ensure service account has edit permissions on the sheet
- Verify spreadsheet ID and tab name are correct
- Check service account JSON format

### Debug Mode

1. Enable **Save Execution Data** in workflow settings
2. Use **Test Workflow** for step-by-step debugging
3. Check individual node outputs for data flow issues
4. Enable verbose logging in Code nodes

### Recovery Procedures

#### Failed Episode Processing
1. Check Google Sheets to see which episodes were marked as generated
2. Manually reset "generated" column to false for failed episodes
3. Re-run workflow or process manually

#### Partial Upload Failures
1. Check Spreaker dashboard for uploaded episodes
2. Update Google Sheets manually with episode IDs/URLs if needed
3. Verify token refresh worked correctly

## 🔄 Maintenance

### Regular Tasks

1. **Monitor executions** - Check for failures weekly
2. **Update tokens** - Refresh Spreaker tokens before expiration
3. **Check quotas** - Monitor OpenAI usage and credits
4. **Review logs** - Look for patterns in errors or performance

### Backup and Recovery

1. **Export workflow** - Regular backups of the n8n workflow
2. **Document customizations** - Track any modifications
3. **Test restore procedures** - Verify backup restoration works

### Updates

1. **Monitor dependencies** - Keep n8n and nodes updated
2. **API changes** - Watch for OpenAI/Spreaker API updates
3. **Feature enhancements** - Regularly review and improve workflow

## 📈 Performance Optimization

### Execution Time

- Each episode takes approximately 3-5 minutes to process
- Content generation: ~2 minutes
- Audio generation: ~1-2 minutes  
- Upload and updates: ~1 minute

### Resource Usage

- Memory: Moderate (audio files are temporary)
- CPU: Intensive during audio generation
- Network: High during uploads
- Storage: Minimal (temporary files cleaned up)

### Scaling Considerations

1. **Parallel Processing**: Episodes process individually, can be parallelized
2. **Rate Limiting**: Respect OpenAI and Spreaker API limits
3. **Batch Size**: Adjust MAX_EPISODES_PER_RUN based on resources
4. **Queue Management**: Consider episode queuing for high volumes

## 🆘 Support Resources

### Documentation
- [Original Roo Documentation](./DOCUMENTATION_INDEX.md)
- [Manual Workflow Guide](./MANUAL_WORKFLOW.md)
- [Complete Process Guide](./COMPLETE_PROCESS_GUIDE.md)

### API Documentation
- [n8n Documentation](https://docs.n8n.io/)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Spreaker API Documentation](https://developers.spreaker.com/)
- [Google Sheets API](https://developers.google.com/sheets/api)

### Community
- [n8n Community Forum](https://community.n8n.io/)
- [OpenAI Community](https://community.openai.com/)

---

*This n8n workflow provides a robust, visual, and maintainable alternative to the original Node.js automation. It maintains full feature parity while offering enhanced monitoring, error handling, and ease of maintenance.*