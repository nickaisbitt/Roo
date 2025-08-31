// Test input string generation for episodes
const sampleRows = [
  {
    'home': '1',
    'episode date': '07/10/2024',
    'episode type': 'Main Podcast',
    'episode title': 'CPTSD 101: Making Sense of Trauma and Healing',
    'episode topic': 'Introduction to \'CPTSD: Let\'s Make Sense of This Shit\' – What You Need to Know',
    '_rowIndex': 2
  },
  {
    'home': '2',
    'episode date': '11/10/2024',
    'episode type': 'Friday Healing',
    'episode title': 'Grounded: Body Scan Meditation for Immediate Calm',
    'episode topic': 'Grounding Technique: Body Scan Meditation',
    '_rowIndex': 3
  },
  {
    'home': '28',
    'episode date': '06/01/2025',
    'episode type': 'SPECIAL EPISODE',
    'episode title': 'CPTSD: Rebuilding Trust in Yourself',
    'episode topic': 'Rebuilding Trust After Trauma',
    '_rowIndex': 29
  }
];

const get = (row, name) => row[name.toLowerCase()] ?? row[name] ?? '';

function pickEpisodeType(v) {
  const s = (v || '').toLowerCase();
  if (s.includes('fri')) return 'friday';
  return s.includes('main') ? 'main' : 'main';
}

import { parsePublishDateDDMMYYYY } from './src/utils.js';

console.log('Testing input string generation:\n');

sampleRows.forEach(row => {
  const dateResult = parsePublishDateDDMMYYYY(get(row, 'episode date'), 'UTC');
  const publishDate = dateResult.date;
  
  const topic = get(row, 'topic') || get(row, 'title') || get(row, 'episode topic') || get(row, 'episode title') || 'Untitled';
  const type = pickEpisodeType(get(row, 'type') || get(row, 'episode_type') || get(row, 'episode type'));
  
  const inputString = `${publishDate.format('DD/MM/YYYY')} ${type === 'main' ? 'Main Podcast' : 'Friday Healing'} **${topic}** ${topic}`;
  
  console.log(`Row ${row._rowIndex}:`);
  console.log(`  Date: ${publishDate.format('DD/MM/YYYY')}`);
  console.log(`  Type: ${type} -> ${type === 'main' ? 'Main Podcast' : 'Friday Healing'}`);
  console.log(`  Topic: ${topic}`);
  console.log(`  Input: ${inputString}`);
  console.log('');
});