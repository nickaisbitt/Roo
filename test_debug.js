// Test script to debug the date parsing and filtering issues
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
dayjs.extend(utc);
dayjs.extend(timezone);

import { coerceBoolean, parsePublishDateDDMMYYYY, withinNextNDays } from './src/utils.js';

// Set environment variable for testing
process.env.EPISODE_TIMEZONE = 'America/Toronto';

console.log('Testing date parsing and filtering logic...');
console.log('Current date:', dayjs().tz('America/Toronto').format('YYYY-MM-DD HH:mm:ss z'));

// Test dates from the Google Sheet (based on screenshots)
const testDates = [
  '11/08/2025',  // August 11, 2025
  '15/08/2025',  // August 15, 2025  
  '18/08/2025',  // August 18, 2025
  '22/08/2025',  // August 22, 2025
  '25/08/2025',  // August 25, 2025
  '29/08/2025',  // August 29, 2025
  '01/09/2025',  // September 1, 2025
  '05/09/2025',  // September 5, 2025
  '08/09/2025',  // September 8, 2025
  '12/09/2025',  // September 12, 2025
];

console.log('\nTesting date parsing:');
testDates.forEach(dateStr => {
  const parsed = parsePublishDateDDMMYYYY(dateStr, 'America/Toronto');
  console.log(`${dateStr} -> ${parsed ? parsed.format('YYYY-MM-DD') : 'INVALID'}`);
});

console.log('\nTesting date range filtering (60 days):');
testDates.forEach(dateStr => {
  const parsed = parsePublishDateDDMMYYYY(dateStr, 'America/Toronto');
  if (parsed) {
    const withinRange = withinNextNDays(parsed, 60);
    console.log(`${dateStr} (${parsed.format('YYYY-MM-DD')}) -> within 60 days: ${withinRange}`);
  }
});

console.log('\nTesting coerceBoolean:');
const testValues = ['TRUE', 'true', 'False', '-', '', null, undefined, '1', '0'];
testValues.forEach(val => {
  console.log(`"${val}" -> ${coerceBoolean(val)}`);
});