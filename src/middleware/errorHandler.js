const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * Global Express error handler.
 * Must be registered as the LAST middleware in app.js.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const isClientError = status >= 400 && status < 500;

  // Log errors (full stack in dev, message only in prod for client errors)
  if (!isClientError || status === 401 || status === 403) {
    logger.error(`${req.method} ${req.path} → ${status}`, {
      message: err.message,
      stack: config.isProduction ? undefined : err.stack,
    });
  }

  // Never expose internal details in production
  const message = config.isProduction && status === 500
    ? 'An internal server error occurred. Please try again later.'
    : err.message || 'Something went wrong';

  res.status(status).json({
    success: false,
    error: message,
    ...(config.isProduction ? {} : { stack: err.stack }),
  });
};

module.exports = errorHandler;
