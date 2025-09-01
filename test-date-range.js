#!/usr/bin/env node

// Test script to understand the current date range issue
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Current withinNextNDays function from utils.js
function withinNextNDays(d, n) {
  if (!d || !d.isValid()) return false;
  const now = dayjs().tz(process.env.EPISODE_TIMEZONE || 'UTC').startOf('day');
  const end = now.add(n, 'day').endOf('day');
  // Allow episodes from 365 days ago to 63 days in the future
  const start = now.subtract(365, 'day').startOf('day');
  const date = d.tz(process.env.EPISODE_TIMEZONE || 'UTC');
  return date.isSameOrAfter(start) && date.isSameOrBefore(end);
}

// Parse date function from utils.js
function parsePublishDateDDMMYYYY(s, tz = 'UTC') {
  if (!s || (typeof s === 'string' && s.trim() === '')) {
    return { date: null, error: 'Empty date string', type: 'empty' };
  }
  
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return { date: null, error: 'Failed to parse DD/MM/YYYY format', type: 'parse_error', value: s };
  
  const [_, dd, mm, yyyy] = m;
  const d = dayjs.tz(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`, tz);
  
  if (!d.isValid()) {
    return { date: null, error: 'Invalid date values', type: 'invalid_date', value: s };
  }
  
  return { date: d, error: null, type: 'success' };
}

console.log('=== Testing Date Range Logic ===');
console.log(`Current time (UTC): ${dayjs().format('YYYY-MM-DD')}`);

// Set timezone to America/Toronto as seen in the logs
process.env.EPISODE_TIMEZONE = 'America/Toronto';
console.log(`Timezone set to: ${process.env.EPISODE_TIMEZONE}`);

const now = dayjs().tz(process.env.EPISODE_TIMEZONE).startOf('day');
console.log(`Now in timezone: ${now.format('YYYY-MM-DD')}`);

const start = now.subtract(365, 'day').startOf('day');
const end63 = now.add(63, 'day').endOf('day');

console.log(`Current range with n=63:`);
console.log(`  Start (365 days ago): ${start.format('YYYY-MM-DD')}`);
console.log(`  End (63 days future):  ${end63.format('YYYY-MM-DD')}`);

// Test dates from the logs that are being skipped
const testDates = [
  '15/12/2025',
  '03/11/2025', 
  '07/11/2025',
  '10/11/2025',
  '14/11/2025',
  '17/11/2025',
  '21/11/2025',
  '02/01/2026'
];

console.log('\n=== Testing Skipped Dates ===');
testDates.forEach(dateStr => {
  const parsed = parsePublishDateDDMMYYYY(dateStr, process.env.EPISODE_TIMEZONE);
  if (parsed.date) {
    const inRange63 = withinNextNDays(parsed.date, 63);
    const daysDiff = parsed.date.diff(now, 'day');
    console.log(`${dateStr} -> ${parsed.date.format('YYYY-MM-DD')} (${daysDiff} days from now) -> In range with n=63: ${inRange63}`);
  } else {
    console.log(`${dateStr} -> Parse error: ${parsed.error}`);
  }
});

// Test what range would be needed
console.log('\n=== Testing Different Range Values ===');
const nValues = [63, 120, 180, 365];
nValues.forEach(n => {
  const end = now.add(n, 'day').endOf('day');
  console.log(`n=${n}: Start=${start.format('YYYY-MM-DD')} End=${end.format('YYYY-MM-DD')}`);
  
  let validCount = 0;
  testDates.forEach(dateStr => {
    const parsed = parsePublishDateDDMMYYYY(dateStr, process.env.EPISODE_TIMEZONE);
    if (parsed.date && withinNextNDays(parsed.date, n)) {
      validCount++;
    }
  });
  console.log(`  ${validCount}/${testDates.length} test dates would be in range`);
});