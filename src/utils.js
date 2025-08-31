import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
dayjs.extend(utc);
dayjs.extend(timezone);

export function coerceBoolean(v) {
  if (typeof v === 'boolean') return v;
  if (v == null || v === '-') return false;
  const s = String(v).trim().toLowerCase();
  return ['true', '1', 'yes', 'y', '✓', '✅'].includes(s);
}

export function parsePublishDateDDMMYYYY(s, tz = 'UTC') {
  if (!s) return null;
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [_, dd, mm, yyyy] = m;
  const d = dayjs.tz(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`, tz);
  return d.isValid() ? d : null;
}

export function withinNextNDays(d, n) {
  if (!d || !d.isValid()) return false;
  const now = dayjs().tz(process.env.EPISODE_TIMEZONE || 'UTC').startOf('day');
  const end = now.add(n, 'day').endOf('day');
  const date = d.tz(process.env.EPISODE_TIMEZONE || 'UTC');
  console.log(`Date check: ${date.format('YYYY-MM-DD HH:mm')} - now: ${now.format('YYYY-MM-DD HH:mm')} - limit: ${end.format('YYYY-MM-DD HH:mm')}`);
  return date.isSameOrAfter(now) && date.isSameOrBefore(end);
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