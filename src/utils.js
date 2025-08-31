import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export function coerceBoolean(v) {
  if (typeof v === 'boolean') return v;
  if (v == null || v === '-') return false;
  const s = String(v).trim().toLowerCase();
  return ['true', '1', 'yes', 'y', '✓', '✅'].includes(s);
}

export function validateDateString(s) {
  if (!s || typeof s !== 'string') {
    return { isValid: false, error: 'Empty or non-string value', type: 'empty' };
  }
  
  const trimmed = s.trim();
  
  // Check for empty string after trimming
  if (trimmed === '') {
    return { isValid: false, error: 'Empty date string', type: 'empty' };
  }
  
  const lowerTrimmed = trimmed.toLowerCase();
  
  // Check for common non-date words
  const nonDateWords = ['bonus', 'tbd', 'pending', 'unknown', 'na', 'n/a', 'tbc', 'to be confirmed'];
  for (const word of nonDateWords) {
    if (lowerTrimmed.includes(word)) {
      return { isValid: false, error: `Contains non-date word: "${word}"`, type: 'special_case', value: lowerTrimmed };
    }
  }
  
  // Check if it looks like a date format
  if (!/\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmed)) {
    return { isValid: false, error: 'Does not match DD/MM/YYYY format', type: 'format_error', value: trimmed };
  }
  
  return { isValid: true };
}

export function parsePublishDateDDMMYYYY(s, tz = 'UTC') {
  if (!s || (typeof s === 'string' && s.trim() === '')) {
    return { date: null, error: 'Empty date string', type: 'empty' };
  }
  
  // First validate the string
  const validation = validateDateString(s);
  if (!validation.isValid) {
    return { date: null, error: validation.error, type: validation.type, value: validation.value || s };
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

export function withinNextNDays(d, n) {
  if (!d || !d.isValid()) return false;
  const now = dayjs().tz(process.env.EPISODE_TIMEZONE || 'UTC').startOf('day');
  const end = now.add(n, 'day').endOf('day');
  // Allow episodes from 365 days ago to 63 days in the future
  const start = now.subtract(365, 'day').startOf('day');
  const date = d.tz(process.env.EPISODE_TIMEZONE || 'UTC');
  return date.isSameOrAfter(start) && date.isSameOrBefore(end);
}

export function ensureNewlinesInPrivateKey(k) {
  return k ? k.replace(/\\n/g, '\n') : k;
}

export function wordCount(s) {
  return s ? s.trim().split(/\s+/).filter(Boolean).length : 0;
}

export function splitForTTS(text, maxChars = 3500) {
  const chunks = [];
  let buf = '';
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if ((buf + ' ' + sentence).length > maxChars) {
      chunks.push(buf.trim());
      buf = sentence;
    } else {
      buf = (buf + ' ' + sentence).trim();
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export function sanitizeTags(s) {
  if (!s) return '';
  return s.toLowerCase()
    .replace(/[^a-z0-9,\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .split(',')
    .map(x => x.trim().replace(/\s+/g, '-'))
    .filter(Boolean)
    .join(',');
}