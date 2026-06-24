const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const logger = require('../utils/logger');

const rateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,   // 15 minutes by default
  max: config.rateLimitMax,             // 30 requests per window by default
  standardHeaders: true,                // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please wait a few minutes before trying again.',
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded: IP=${req.ip} Path=${req.path}`);
    res.status(429).json(options.message);
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

module.exports = rateLimiter;
