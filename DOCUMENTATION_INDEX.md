# 🎙️ Roo Podcast Automation - Documentation Index

Welcome to the comprehensive documentation for the Roo podcast automation system. This collection of documents will help you understand, troubleshoot, and manually operate the podcast generation workflow.

## 📚 Documentation Overview

### Core Documentation
- **[README.md](./README.md)** - Main project documentation with automation overview
- **[MANUAL_WORKFLOW.md](./MANUAL_WORKFLOW.md)** - Complete manual workflow instructions
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Essential commands and quick reference
- **[EXAMPLE_WALKTHROUGH.md](./EXAMPLE_WALKTHROUGH.md)** - Step-by-step example processing one episode

### Tools & Utilities
- **[diagnostics.sh](./diagnostics.sh)** - System diagnostic and health check script
- **[oauth-server.js](./oauth-server.js)** - OAuth helper for generating Spreaker tokens
- **[roo-dev.js](./roo-dev.js)** - Development CLI with Unicode search and project initialization
- **[DEV_TOOLS.md](./DEV_TOOLS.md)** - Complete guide to development tools and utilities

## 🚀 Getting Started

### For First-Time Setup
1. **Run diagnostics**: `./diagnostics.sh` to check your configuration
2. **Review environment setup** in [MANUAL_WORKFLOW.md](./MANUAL_WORKFLOW.md#prerequisites)
3. **Test with example** from [EXAMPLE_WALKTHROUGH.md](./EXAMPLE_WALKTHROUGH.md)

### For Troubleshooting
1. **Run diagnostics**: `./diagnostics.sh` to identify issues
2. **Check troubleshooting section** in [MANUAL_WORKFLOW.md](./MANUAL_WORKFLOW.md#troubleshooting)
3. **Review error solutions** in [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#common-error-messages--solutions)

### For Manual Operation
1. **Follow complete workflow** in [MANUAL_WORKFLOW.md](./MANUAL_WORKFLOW.md)
2. **Use command reference** from [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
3. **Follow practical example** in [EXAMPLE_WALKTHROUGH.md](./EXAMPLE_WALKTHROUGH.md)

## 🔧 Workflow Overview

The Roo system automates this workflow:

```
Google Sheets → OpenAI Content → TTS Audio → Spreaker Upload → Update Sheets
     ↓              ↓              ↓           ↓              ↓
  Read episode   Generate      Create MP3   Upload with    Mark as
  topics &      script,       using        metadata to    generated
  metadata      title,        OpenAI       podcast        & add URLs
               description,   gpt-4o-mini   platform
               tags          TTS (Fable)
```

Each step can be performed manually using the documentation provided.

## 📋 Common Use Cases

### "The automation is broken - help!"
1. Run: `./diagnostics.sh`
2. Check: [Troubleshooting Guide](./MANUAL_WORKFLOW.md#troubleshooting)
3. Try: Manual process from [MANUAL_WORKFLOW.md](./MANUAL_WORKFLOW.md)

### "I need to process one episode manually"
1. Follow: [EXAMPLE_WALKTHROUGH.md](./EXAMPLE_WALKTHROUGH.md)
2. Reference: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for commands

### "How does this system actually work?"
1. Read: [README.md](./README.md) for overview
2. Study: [MANUAL_WORKFLOW.md](./MANUAL_WORKFLOW.md) for details
3. Try: [EXAMPLE_WALKTHROUGH.md](./EXAMPLE_WALKTHROUGH.md) hands-on

### "I want to explore or modify the codebase"
1. Initialize: `npm run init` - Scan project structure and generate context
2. Search: `npm run search "pattern"` - Find code with Unicode support
3. Review: [DEV_TOOLS.md](./DEV_TOOLS.md) - Complete development tools guide
4. Monitor: Built-in memory management and resource cleanup tools

### "I'm getting OAuth/token errors"
1. Check: Token section in [MANUAL_WORKFLOW.md](./MANUAL_WORKFLOW.md#step-4-manage-spreaker-authentication)
2. Use: [oauth-server.js](./oauth-server.js) to regenerate tokens
3. Reference: [Token troubleshooting](./QUICK_REFERENCE.md#common-error-messages--solutions)

## 🔍 System Health Checks

### Regular Maintenance
```bash
# Check system status
./diagnostics.sh

# Test automation (dry run)
DRY_RUN=true npm start

# Monitor logs
tail -f /var/log/railway/app.log  # or your log location
```

### Before Important Runs
1. Verify all environment variables are current
2. Test API connectivity with diagnostics script
3. Confirm Google Sheets has episodes to process
4. Check Spreaker token validity

## 🆘 Emergency Procedures

### If automation fails during production
1. **Stop the process** to prevent partial uploads
2. **Run diagnostics** to identify the issue
3. **Check Google Sheets** to see what was already processed  
4. **Manual recovery** using the workflow documentation
5. **Update tracking** to reflect actual status

### If tokens expire mid-process
1. **Generate new tokens** using oauth-server.js
2. **Update environment variables**
3. **Resume from last successful episode**
4. **Verify all uploads completed successfully**

## 💡 Pro Tips

- **Always test with DRY_RUN=true first**
- **Keep backup copies of working tokens**
- **Monitor API quotas and usage**
- **Update Google Sheets immediately after manual operations**
- **Test the full workflow in a staging environment**

## 📞 Support Resources

- **Spreaker API**: https://developers.spreaker.com/
- **OpenAI API**: https://platform.openai.com/docs
- **Google Sheets API**: https://developers.google.com/sheets/api
- **Railway Platform**: https://docs.railway.app/

---

*This documentation was created to ensure the podcast automation workflow is transparent, maintainable, and recoverable. Keep these documents updated as the system evolves.*