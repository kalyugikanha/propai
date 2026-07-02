/**
 * Google Sheets Service
 * Handles all read/write operations against Google Sheets using a Service Account.
 *
 * Features:
 *   - Header-driven column mapping (future-column-safe)
 *   - 5-minute in-memory cache for properties
 *   - Append-only lead capture
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const { PROPERTIES_SHEET_NAME, LEADS_SHEET_NAME, SHEETS_CACHE_TTL_MS } = require('../config/constants');
const logger = require('../utils/logger');

// ── Auth ──────────────────────────────────────────────────────────────────────

let _auth = null;

/**
 * Build and return a GoogleAuth client (cached).
 * Supports both JSON string and key file path.
 */
const getAuth = () => {
  if (_auth) return _auth;

  let credentials;

  if (config.googleServiceAccountJson) {
    // Prefer inline JSON string (ideal for Railway / cloud env vars)
    try {
      credentials = JSON.parse(config.googleServiceAccountJson);
    } catch (err) {
      logger.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON. Check for unescaped newlines in the private_key.');
      throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON format');
    }
  } else if (config.googleServiceAccountKeyPath) {
    // Fall back to file path
    const absPath = path.resolve(config.googleServiceAccountKeyPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Service account key file not found: ${absPath}`);
    }
    credentials = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
  } else {
    throw new Error(
      'No Google credentials configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY_PATH in .env'
    );
  }

  _auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return _auth;
};

/**
 * Get an authorized Google Sheets API client.
 */
const getSheetsClient = async () => {
  const auth = getAuth();
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
};

// ── Cache ─────────────────────────────────────────────────────────────────────

let propertiesCache = {
  data: null,
  fetchedAt: null,
};

const isCacheValid = () =>
  propertiesCache.data !== null &&
  propertiesCache.fetchedAt !== null &&
  Date.now() - propertiesCache.fetchedAt < SHEETS_CACHE_TTL_MS;

const invalidateCache = () => {
  propertiesCache.data = null;
  propertiesCache.fetchedAt = null;
  logger.info('Properties cache invalidated');
};

// ── Properties ────────────────────────────────────────────────────────────────

/**
 * Read all properties from the Properties sheet.
 * Returns an array of plain objects keyed by the sheet's header row.
 *
 * @param {boolean} forceRefresh  - bypass cache
 * @returns {Promise<object[]>}
 */
const getProperties = async (forceRefresh = false) => {
  if (!forceRefresh && isCacheValid()) {
    logger.debug('Returning cached properties');
    return propertiesCache.data;
  }

  logger.info('Fetching properties from Google Sheets...');

  let sheets;
  try {
    sheets = await getSheetsClient();
  } catch (err) {
    logger.error('Google Sheets auth error:', err.message);
    throw new Error('Unable to connect to Google Sheets. Check service account credentials.');
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSpreadsheetId,
    range: `A1:Z`,  // Z covers up to 26 columns
  });

  const rows = response.data.values;

  if (!rows || rows.length < 2) {
    logger.warn('Properties sheet is empty or has no data rows');
    return [];
  }

  // Row 0 = headers, Row 1+ = data
  const headers = rows[0];
  const properties = rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] !== undefined ? row[i].toString().trim() : '';
    });
    return obj;
  });

  // Update cache
  propertiesCache.data = properties;
  propertiesCache.fetchedAt = Date.now();

  logger.info(`Fetched ${properties.length} properties from Sheets (cached for 5 min)`);
  return properties;
};

// ── Leads ─────────────────────────────────────────────────────────────────────

/**
 * Append a single lead row to the Leads sheet.
 * @param {string[]} row  - ordered array of values matching the Leads sheet columns
 */
const appendLead = async (row) => {
  logger.info('Appending lead to Google Sheets...');

  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSpreadsheetId,
    range: `${LEADS_SHEET_NAME}!A:J`,  // J covers up to Email column (landing page)
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [row],
    },
  });

  logger.info('Lead appended successfully');
};

// ── Cache Stats ───────────────────────────────────────────────────────────────

const getCacheStats = () => ({
  cached: isCacheValid(),
  cachedAt: propertiesCache.fetchedAt ? new Date(propertiesCache.fetchedAt).toISOString() : null,
  count: propertiesCache.data ? propertiesCache.data.length : 0,
  expiresInMs: propertiesCache.fetchedAt
    ? Math.max(0, SHEETS_CACHE_TTL_MS - (Date.now() - propertiesCache.fetchedAt))
    : 0,
});

module.exports = { getProperties, appendLead, invalidateCache, getCacheStats };
