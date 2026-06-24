const { body, param, query, validationResult } = require('express-validator');
const { PROPERTY_TYPES, JAIPUR_LOCATIONS } = require('../config/constants');

/**
 * Middleware to check validation results and return 400 on failure.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ── Chat ──────────────────────────────────────────────────────────────────────

const validateChat = [
  body('sessionId')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('sessionId must be a string under 100 characters'),
  body('message')
    .isString()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('message must be between 1 and 1000 characters'),
  validate,
];

const validateChatStart = [
  body('sessionId')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('sessionId must be a string under 100 characters'),
  validate,
];

// ── Property Search ───────────────────────────────────────────────────────────

const validateSearchProperties = [
  body('propertyType')
    .optional()
    .isString()
    .isIn(PROPERTY_TYPES)
    .withMessage(`propertyType must be one of: ${PROPERTY_TYPES.join(', ')}`),
  body('location')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('location must be under 100 characters'),
  body('budget')
    .optional(), // budget can be a string or number — validated downstream by budgetParser
  validate,
];

// ── Session ───────────────────────────────────────────────────────────────────

const validateSessionId = [
  param('sessionId')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Invalid sessionId'),
  validate,
];

// ── Lead ──────────────────────────────────────────────────────────────────────

const validateSaveLead = [
  body('sessionId')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('sessionId is required'),
  validate,
];

module.exports = {
  validateChat,
  validateChatStart,
  validateSearchProperties,
  validateSessionId,
  validateSaveLead,
};
