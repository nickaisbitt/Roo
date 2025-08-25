# Railway Podcast Automation

This Cron job runs once per week on Railway and will:
- Read your Google Sheet for any episode with a publish date in the next 60 days that isn't generated yet
- Generate the script + title + plain & HTML descriptions + tags
- TTS with `gpt-4o-mini-tts` (voice `fable`)
- Upload to Spreaker and mark the sheet row as generated
