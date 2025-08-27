import { google } from 'googleapis';

function getSheetsClient() {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  creds.private_key = creds.private_key.replace(/\\n/g, '\n');
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes
  });
  return google.sheets({ version: 'v4', auth });
}

export async function readTable({ spreadsheetId, tabName }) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tabName}!A:Z` });
  const rows = res.data.values || [];
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => (h || '').toString().trim());
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = { _rowIndex: i + 1 };
    headers.forEach((h, idx) => obj[h.toLowerCase()] = (row[idx] ?? '').toString());
    out.push(obj);
  }
  return { headers, rows: out };
}

export async function writeBack({ spreadsheetId, tabName, rowIndex, headers, data }) {
  const sheets = getSheetsClient();
  const ensure = (name) => {
    const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
    if (idx === -1) { headers.push(name); return headers.length - 1; }
    return idx;
  };
  const idxGenerated = ensure('generated');
  const idxEpisodeId = ensure('spreaker_episode_id');
  const idxUrl = ensure('spreaker_url');
  const idxStamp = ensure('generated_at');
  const range = `${tabName}!A${rowIndex}:Z${rowIndex}`;
  const rowArray = new Array(26).fill('');
  headers.forEach((h, i) => {
    const key = h.toLowerCase();
    const v = data[key];
    if (typeof v !== 'undefined') rowArray[i] = String(v);
  });
  rowArray[idxGenerated] = 'TRUE';
  rowArray[idxEpisodeId] = data['spreaker_episode_id'] ?? '';
  rowArray[idxUrl] = data['spreaker_url'] ?? '';
  rowArray[idxStamp] = data['generated_at'] ?? new Date().toISOString();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [rowArray] }
  });
}
