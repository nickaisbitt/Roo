# 🚀 Roo n8n Quick Setup Guide

## ⚡ 5-Minute Setup

This guide gets you up and running with the Roo podcast automation in n8n as quickly as possible.

## 📋 Prerequisites Checklist

- [ ] n8n instance (self-hosted or cloud)
- [ ] OpenAI API key with GPT-4o access
- [ ] Google Sheets with episode data
- [ ] Google Service Account with Sheets access
- [ ] Spreaker app credentials (Client ID, Secret, Refresh Token)
- [ ] Spreaker show ID

## 🎯 Step-by-Step Setup

### 1. Import Workflow (2 minutes)

1. Download `n8n-workflow.json` from this repository
2. In n8n, go to **Workflows** → **Import**
3. Upload the JSON file
4. Workflow will appear with all 24 nodes connected

### 2. Set Up Credentials (1 minute)

#### OpenAI Credential
1. Go to **Credentials** → **Add Credential**
2. Search for "OpenAI"
3. Create credential with ID: `openai-credentials`
4. Enter your OpenAI API key (starts with `sk-`)

### 3. Configure Variables (2 minutes)

Set these environment variables in your n8n instance:

#### Essential Variables (Copy-paste ready)
```bash
# Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID="your-spreadsheet-id-here"
GOOGLE_SHEETS_TAB_NAME="Episodes"
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"..."}' # Full JSON

# OpenAI  
OPENAI_API_KEY="sk-your-openai-api-key"

# Spreaker
SPREAKER_CLIENT_ID="12345"
SPREAKER_CLIENT_SECRET="your-secret"
SPREAKER_REFRESH_TOKEN="your-refresh-token"
SPREAKER_SHOW_ID="98765"

# Safety First
DRY_RUN="true"  # Set to false once tested
```

#### Variable Setup by Platform

**n8n Cloud:**
1. Settings → Environment Variables
2. Add each variable (without N8N_VARIABLE_ prefix)

**Self-Hosted Docker:**
```bash
docker run -it --rm \
  -e N8N_VARIABLE_GOOGLE_SHEETS_SPREADSHEET_ID="your-id" \
  -e N8N_VARIABLE_OPENAI_API_KEY="sk-your-key" \
  # ... add all variables
  n8nio/n8n
```

**Self-Hosted with .env:**
```bash
N8N_VARIABLE_GOOGLE_SHEETS_SPREADSHEET_ID=your-id
N8N_VARIABLE_OPENAI_API_KEY=sk-your-key
# ... add all variables
```

## ✅ Quick Test

1. **Enable Dry Run**: Set `DRY_RUN="true"`
2. **Manual Test**: Click "Test Workflow" in n8n
3. **Check Output**: Look for "DRY RUN: Would upload episode..." in logs
4. **Verify Google Sheets**: No actual changes should be made

## 🎛️ Customize Settings

### Trigger Schedule
- **Current**: Monday 8:00 AM
- **Change**: Edit "Weekly Trigger" node
- **Options**: Any cron schedule

### Processing Limits
- **Current**: 2 episodes per run
- **Change**: Set `MAX_EPISODES_PER_RUN="5"`

### Content Model
- **Current**: gpt-4o
- **Change**: Set `OPENAI_TEXT_MODEL="gpt-3.5-turbo"`

## 🔧 Quick Fixes

### Missing Google Service Account
```bash
# Get from Google Cloud Console
# IAM & Admin → Service Accounts → Create
# Grant "Editor" role to your spreadsheet
# Download JSON key
GOOGLE_SERVICE_ACCOUNT_JSON='paste-full-json-here'
```

### Invalid Spreaker Token
```bash
# Use oauth-server.js from repo
# Or regenerate in Spreaker app settings
SPREAKER_REFRESH_TOKEN="new-token-here"
```

### OpenAI Model Access
```bash
# If gpt-4o not available
OPENAI_TEXT_MODEL="gpt-4"
# Or
OPENAI_TEXT_MODEL="gpt-3.5-turbo"
```

## 📊 Monitor Your First Run

### Success Indicators
```
✅ Starting Roo Podcast Automation Workflow
✅ Found X candidate episodes
✅ Processing episode: [title] ([type])
✅ Content generation complete
✅ Upload successful
✅ Workflow Complete!
```

### Common First-Run Issues

| Error | Quick Fix |
|-------|-----------|
| "Missing required variables" | Check variable names match exactly |
| "OpenAI API error" | Verify API key and model access |
| "Google Sheets error" | Check spreadsheet ID and service account |
| "Spreaker auth failed" | Regenerate refresh token |

## 🚀 Go Live

Once dry run succeeds:

1. **Disable Dry Run**: `DRY_RUN="false"`
2. **Enable Workflow**: Turn on the workflow in n8n
3. **Monitor**: Check executions tab for automated runs
4. **Verify**: Episodes appear in Spreaker and sheets update

## 📞 Support

### Quick Help
- **Logs**: Check n8n execution logs
- **Variables**: Verify all environment variables
- **Credentials**: Ensure OpenAI credential is active
- **Permissions**: Check Google Sheets access

### Full Documentation
- [Complete Deployment Guide](./N8N_DEPLOYMENT_GUIDE.md)
- [Technical Specification](./N8N_TECHNICAL_SPEC.md)
- [Original Roo Documentation](./DOCUMENTATION_INDEX.md)

---

🎉 **You're all set!** Your Roo podcast automation will now run weekly, generating and uploading episodes automatically.