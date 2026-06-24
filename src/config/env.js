/**
 * Environment Configuration
 * Loads .env, validates required variables, and exports a typed config object.
 * Import this ONCE in server.js before anything else.
 */
require('dotenv').config();

const required = ['GEMINI_API_KEY', 'GOOGLE_SPREADSHEET_ID'];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `\n❌ PropAI startup error: Missing required environment variables:\n  ${missing.join('\n  ')}\n` +
    `Copy .env.example to .env and fill in the values.\n`
  );
  process.exit(1);
}

// Warn about missing Google credentials
if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
  console.warn(
    `\n⚠️  WARNING: Neither GOOGLE_SERVICE_ACCOUNT_JSON nor GOOGLE_SERVICE_ACCOUNT_KEY_PATH is set.\n` +
    `Google Sheets integration will not work. See docs/sheets-setup.md for instructions.\n`
  );
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Gemini
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',

  // Google Sheets
  googleSpreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || null,
  googleServiceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || null,

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Session
  sessionTtlMs: parseInt(process.env.SESSION_TTL_HOURS, 10) * 60 * 60 * 1000 || 2 * 60 * 60 * 1000,

  // Property search
  topPropertiesLimit: parseInt(process.env.TOP_PROPERTIES_LIMIT, 10) || 5,

  // Rate limiting
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 30,
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Branding
  agencyName: process.env.AGENCY_NAME || 'PropAI Jaipur',
  agentName: process.env.AGENT_NAME || 'Priya',
};

module.exports = config;
