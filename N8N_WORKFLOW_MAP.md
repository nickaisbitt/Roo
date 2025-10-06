# 🎙️ Roo n8n Workflow Visual Map

## 📊 Complete Process Flow Diagram

```
┌─────────────────┐
│  Weekly Trigger │ 🕐 (Cron: Mon 8AM)
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Initialize      │ ⚙️ (Validate env vars)
│ Workflow        │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Read Episode    │ 📊 (Google Sheets)
│ Data            │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Filter Episodes │ 🔍 (Date/status filter)
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Episodes Exist? │ ❓ (Conditional)
└─────┬─────┬─────┘
      │     │
     Yes    No
      │     │
      │     ▼
      │ ┌─────────────────┐
      │ │ No Episodes     │ ⏹️ (Graceful exit)
      │ │ Handler         │
      │ └─────────────────┘
      │
      ▼
┌─────────────────┐
│ Prepare Content │ 📝 (Setup sections)
│ Generation      │
└─────────┬───────┘
          │
          ▼
    ╔═══════════════════════════╗
    ║    CONTENT GENERATION     ║
    ║         LOOP              ║
    ╚═══════════════════════════╝
          │
          ▼
┌─────────────────┐
│ Create Section  │ 🎯 (Generate prompts)
│ Prompt          │ ◄──────────────┐
└─────────┬───────┘                │
          │                        │
          ▼                        │
┌─────────────────┐                │
│ Generate        │ 🤖 (OpenAI GPT-4o)  │
│ Section         │                │
└─────────┬───────┘                │
          │                        │
          ▼                        │
┌─────────────────┐                │
│ Process Section │ ⚡ (Word count/loop) │
└─────────┬───────┘                │
          │                        │
          ▼                        │
┌─────────────────┐                │
│ More Sections?  │ ❓ (Continue loop?)  │
└─────┬─────┬─────┘                │
      │     │                      │
     Yes    No                     │
      │     │                      │
      └─────┼──────────────────────┘
            │
            ▼
    ╔═══════════════════════════╗
    ║   PARALLEL GENERATION     ║
    ║    (4 simultaneous)       ║
    ╚═══════════════════════════╝
            │
         ┌──┴──┐
         │     │
    ┌────▼──┐ ┌▼────────┐
    │Title  │ │Descrip- │
    │Gen    │ │tion Gen │
    └────┬──┘ └┬────────┘
         │     │
    ┌────▼──┐ ┌▼────────┐
    │HTML   │ │Tags     │
    │Desc   │ │Gen      │
    └────┬──┘ └┬────────┘
         │     │
         └──┬──┘
            │
            ▼
┌─────────────────┐
│ Combine Content │ 📋 (Add CTA, assemble)
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Generate Audio  │ 🎵 (OpenAI TTS Fable)
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Check Dry Run   │ 🧪 (Test mode check)
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Upload Needed?  │ ❓ (Conditional)
└─────┬─────┬─────┘
      │     │
    Actual  Dry Run
      │     │
      │     └─────────────┐
      │                   │
      ▼                   │
┌─────────────────┐       │
│ Refresh Spreaker│ 🔄 (OAuth token) │
│ Token           │       │
└─────────┬───────┘       │
          │               │
          ▼               │
┌─────────────────┐       │
│ Upload to       │ ⬆️ (Spreaker API) │
│ Spreaker        │       │
└─────────┬───────┘       │
          │               │
          └───────┬───────┘
                  │
                  ▼
┌─────────────────┐
│ Process Upload  │ ✅ (Extract URLs/IDs)
│ Result          │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Update Google   │ 📝 (Mark generated)
│ Sheets          │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Workflow        │ 🎉 (Summary & logs)
│ Complete        │
└─────────────────┘
```

## 🔗 Node Relationship Matrix

| From Node | To Node(s) | Condition | Type |
|-----------|------------|-----------|------|
| Weekly Trigger | Initialize Workflow | Always | Sequential |
| Initialize Workflow | Read Episode Data | Always | Sequential |
| Read Episode Data | Filter Episodes | Always | Sequential |
| Filter Episodes | Episodes Exist? | Always | Conditional |
| Episodes Exist? | Prepare Content Generation | Episodes found | True branch |
| Episodes Exist? | No Episodes Handler | No episodes | False branch |
| Prepare Content Generation | Create Section Prompt | Always | Loop entry |
| Create Section Prompt | Generate Section | Always | Sequential |
| Generate Section | Process Section | Always | Sequential |
| Process Section | More Sections? | Always | Conditional |
| More Sections? | Create Section Prompt | More sections | Loop back |
| More Sections? | Generate Title, Description, HTML Desc, Tags | All sections done | Parallel |
| All parallel nodes | Combine Content | All complete | Merge |
| Combine Content | Generate Audio | Always | Sequential |
| Generate Audio | Check Dry Run | Always | Sequential |
| Check Dry Run | Upload Needed? | Always | Conditional |
| Upload Needed? | Refresh Spreaker Token | Real upload | True branch |
| Upload Needed? | Process Upload Result | Dry run | False branch |
| Refresh Spreaker Token | Upload to Spreaker | Always | Sequential |
| Upload to Spreaker | Process Upload Result | Always | Sequential |
| Process Upload Result | Update Google Sheets | Always | Sequential |
| Update Google Sheets | Workflow Complete | Always | Sequential |

## 🎯 Critical Decision Points

### 1. Episodes Exist? (Node 5)
- **Purpose**: Prevents empty runs
- **True**: Continue to content generation
- **False**: Graceful exit with logging

### 2. More Sections? (Node 10)
- **Purpose**: Controls section generation loop
- **True**: Generate next section (loop back)
- **False**: Move to parallel final content generation

### 3. Upload Needed? (Node 18)
- **Purpose**: Handles dry run vs production mode
- **True**: Perform actual Spreaker upload
- **False**: Skip upload, use mock data

## 🔄 Loop Structures

### Main Content Generation Loop
```
Create Section Prompt → Generate Section → Process Section → More Sections?
                                                                    │
                                            ┌─────────────────────┘
                                            │ (Yes: Continue)
                                            ▼
                                    Create Section Prompt
                                            │
                                            │ (No: Exit to parallel)
                                            ▼
                                    Parallel Generation
```

### Episode Processing Loop
```
Filter Episodes outputs multiple episodes
                ↓
Each episode processes through entire workflow
                ↓
All episodes merge at Workflow Complete
```

## ⚡ Parallel Processing Nodes

After section generation completes, these 4 nodes run simultaneously:

1. **Generate Title** - Creates SEO-optimized title
2. **Generate Description** - Creates plain text description  
3. **Generate HTML Description** - Creates HTML description
4. **Generate Tags** - Creates 20 SEO tags

All 4 must complete before proceeding to "Combine Content".

## 🎨 Node Type Distribution

- **Triggers**: 1 (Cron)
- **Code Logic**: 8 (Custom JavaScript)
- **OpenAI**: 6 (Content + Audio generation)
- **HTTP Requests**: 2 (Spreaker API)
- **Google Sheets**: 2 (Read + Write)
- **Conditionals**: 3 (Decision points)
- **Credentials**: 2 (OpenAI, Google)

## 📊 Execution Statistics

- **Total Nodes**: 24
- **Sequential Steps**: 18
- **Parallel Steps**: 4
- **Decision Points**: 3
- **API Calls**: 8-12 per episode
- **Loop Iterations**: 6-9 per episode (depending on type)

## 🛠️ Maintenance Points

### Regular Updates Needed
- **OpenAI Models**: Update model versions as available
- **Spreaker Tokens**: Refresh when expired
- **Google Credentials**: Renew service account if needed
- **Episode Structures**: Modify section counts/targets

### Monitoring Points
- **API Rate Limits**: OpenAI, Spreaker
- **Token Expiration**: Spreaker refresh tokens
- **Quota Usage**: OpenAI credits
- **Execution Time**: Total workflow duration

---

*This visual map provides a complete overview of the n8n workflow structure, enabling quick understanding of the process flow and maintenance requirements.*