export const EPISODE_STRUCTURES={
  main:[
    {name:'Opening & Welcome',target:500,description:'Warm opening with episode preview'},
    {name:'Topic Introduction',target:1000,description:'Personal story and topic setup'},
    {name:'Deep Dive Part 1',target:1200,description:'Core concepts and experiences'},
    {name:'Research & Evidence',target:1500,description:'Studies, citations, and scientific backing'},
    {name:'Deep Dive Part 2',target:1200,description:'Advanced concepts and nuances'},
    {name:'Listener Stories',target:1500,description:'Community experiences and validation'},
    {name:'Practical Tools Part 1',target:1000,description:'Techniques and exercises'},
    {name:'Practical Tools Part 2',target:1000,description:'More tools and real-world application'},
    {name:'Integration & Wrap-up',target:600,description:'Bringing it all together and closing'}
  ],
  friday:[
    {name:'Opening & Welcome',target:400,description:'Warm Friday healing opening'},
    {name:'Topic Exploration',target:800,description:'Core topic with personal stories'},
    {name:'Research & Evidence',target:600,description:'Supporting studies and citations'},
    {name:'Community Focus',target:700,description:'Listener stories and shared experiences'},
    {name:'Practical Tools',target:400,description:'Healing techniques and exercises'},
    {name:'Closing & Preview',target:300,description:'Gentle wrap-up and next episode preview'}
  ]
};
export function createSectionPrompt(section,input,completedSections,index,totalSections){return `You are Gregory, host of "CPTSD: Let's Make Sense of This Shit." Generate the "${section.name}" section that flows seamlessly from previous sections.

EPISODE INPUT: ${input}

SECTION REQUIREMENTS:
- Section: ${section.name}
- Target: EXACTLY ${section.target} words (count as you write)
- Purpose: ${section.description}
- Voice: Gregory's compassionate, validating, gently humorous, deeply practical style
- Format: Natural conversational paragraphs only - no headings, lists, or stage directions

${index===0?`OPENING SECTION - Start with a warm welcome (avoid clichés). Include a detailed preview.`:`CONTINUATION SECTION - Flow from prior content without re-introductions.`}
${index===totalSections-1?`CLOSING SECTION - Wrap up naturally. End with the Supporters Club CTA exactly as specified.`:''}

${completedSections.length>0?`Previous sections covered: ${completedSections.map(s=>s.name).join(', ')}
Last section ended with: ${completedSections[completedSections.length-1].content.split(' ').slice(-50).join(' ')}`:`This is the first section.`}

CRITICAL FLOW RULES:
- No repeated intros
- Use natural transitions
- EXACTLY ${section.target} words
- Continue a single uninterrupted conversation.`;}
export function createTitlePrompt(script){return `Based on this complete CPTSD podcast script, create a 60-70 character SEO title that includes "CPTSD". Return ONLY the title. Script: ${script}`;}
export function createDescriptionPrompt(script){return `Create a universal podcast description with bold headers and "•" bullets per this template. 450-850 words. Script: ${script}`;}
export function createHTMLDescriptionPrompt(script){return `Create a Spotify-friendly HTML description (p,strong,ul,li,a,br only). 450-850 words. Script: ${script}`;}
export function createTagsPrompt(script){return `Generate exactly 20 single-word, lowercase SEO tags as a comma-separated list. Script: ${script}`;}
