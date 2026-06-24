/**
 * PropAI Backend — Server Entry Point
 * Loads environment config, starts the HTTP server, and handles graceful shutdown.
 */

// Load and validate environment FIRST (will exit if required vars are missing)
require('./src/config/env');

const app = require('./src/app');
const config = require('./src/config/env');
const logger = require('./src/utils/logger');

const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(`🏠  PropAI Backend started`);
  logger.info(`🚀  Port:        ${PORT}`);
  logger.info(`🌎  Environment: ${config.nodeEnv}`);
  logger.info(`🤖  Gemini model: ${config.geminiModel}`);
  logger.info(`🏢  Agency:      ${config.agencyName}`);
  logger.info(`📊  Sheets ID:   ${config.googleSpreadsheetId.slice(0, 12)}...`);
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

const shutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed. Goodbye! 👋');
    process.exit(0);
  });

  // Force exit after 10s if hanging
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Unhandled Errors ──────────────────────────────────────────────────────────

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason: String(reason), promise });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception — shutting down:', err);
  process.exit(1);
});

module.exports = server;
