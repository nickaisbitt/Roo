import fetch from 'node-fetch';
const OPENAI_API_KEY=process.env.OPENAI_API_KEY;
const TEXT_MODEL=process.env.OPENAI_TEXT_MODEL||'gpt-4o';
export async function chatComplete(messages,{max_tokens=1500,temperature=0.7}={}){
  const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Authorization':`Bearer ${OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:TEXT_MODEL,messages,temperature,max_tokens})});
  if(!res.ok){throw new Error(`OpenAI chat error ${res.status}: ${await res.text()}`);} 
  const data=await res.json(); 
  return (data.choices?.[0]?.message?.content||'').trim();
}