/**
 * Debug script - run with: node debug-sheet.js
 * Shows all sheet tabs and column headers
 */
require('dotenv').config();
const { google } = require('googleapis');

async function debugSheet() {
  let credentials;
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;

  if (json) {
    credentials = JSON.parse(json);
  } else if (keyPath) {
    credentials = JSON.parse(require('fs').readFileSync(require('path').resolve(keyPath), 'utf-8'));
  } else {
    console.error('No Google credentials found in .env');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  // Step 1: Get all sheet tab names
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  console.log('\n=== SHEET TABS ===');
  const tabNames = meta.data.sheets.map(s => s.properties.title);
  tabNames.forEach((t, i) => console.log(`  Tab ${i+1}: "${t}"`));

  // Step 2: Read first tab headers and sample rows
  const firstTab = tabNames[0];
  console.log(`\n=== READING TAB: "${firstTab}" ===`);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${firstTab}'!A1:Z5`,
  });

  const rows = response.data.values || [];
  if (rows.length === 0) {
    console.log('Sheet is empty!');
    return;
  }

  const headers = rows[0];
  console.log('\n=== COLUMN HEADERS (Row 1) ===');
  headers.forEach((h, i) => {
    const col = String.fromCharCode(65 + i);
    console.log(`  Col ${col} (${i}): "${h}"`);
  });

  console.log('\n=== SAMPLE ROWS ===');
  rows.slice(1, 4).forEach((row, rowIdx) => {
    console.log(`\n  Row ${rowIdx + 2}:`);
    headers.forEach((h, i) => {
      if (row[i]) console.log(`    "${h}": "${row[i]}"`);
    });
  });
}

debugSheet().then(() => process.exit(0)).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
