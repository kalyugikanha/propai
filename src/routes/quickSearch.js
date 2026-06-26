/**
 * Quick Search & Hot Deals Routes
 *
 * POST /api/quick-search  — Accept all lead fields at once, search properties, save lead
 * GET  /api/hot-deals     — Return properties where Status = "Hot Deal"
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const propertyService = require('../services/propertyService');
const geminiService = require('../services/geminiService');
const sheetsService = require('../services/sheetsService');
const { generateSessionId, isValidIndianMobile, formatDateIN } = require('../utils/helpers');
const { parse: parseBudget } = require('../utils/budgetParser');
const { PROPERTY_TYPES, PROPERTY_COLUMNS: COL } = require('../config/constants');
const logger = require('../utils/logger');

// ── Validation helper ─────────────────────────────────────────────────────────
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

// ── POST /api/quick-search ────────────────────────────────────────────────────
const validateQuickSearch = [
  body('fullName')
    .isString().trim().isLength({ min: 2, max: 100 })
    .withMessage('Full name must be 2-100 characters'),
  body('mobile')
    .isString().trim()
    .withMessage('Mobile number is required'),
  body('email')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('propertyType')
    .isString().trim()
    .withMessage('Property type is required'),
  body('budget')
    .isString().trim().isLength({ min: 1, max: 50 })
    .withMessage('Budget is required'),
  body('area')
    .isString().trim().isLength({ min: 1, max: 100 })
    .withMessage('Preferred area is required'),
  validate,
];

router.post('/quick-search', validateQuickSearch, async (req, res, next) => {
  try {
    const { fullName, mobile, email, propertyType, budget, area } = req.body;

    // Validate mobile
    const cleanedMobile = mobile.replace(/[\s\-()]/g, '');
    if (!isValidIndianMobile(cleanedMobile)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid 10-digit Indian mobile number',
      });
    }

    logger.info(`POST /quick-search | name="${fullName}" mobile="${cleanedMobile}" type="${propertyType}" area="${area}" budget="${budget}"`);

    // Parse budget
    let budgetAmount = parseBudget(budget);
    if (!budgetAmount) {
      const aiParsed = await geminiService.parseBudgetWithAI(budget);
      budgetAmount = aiParsed.amount;
    }

    // Search properties
    const matchedProperties = await propertyService.searchProperties({
      propertyType,
      location: area,
      budget: budgetAmount || budget,
    });

    const formattedProps = matchedProperties.map(propertyService.formatProperty);

    // Generate AI recommendation
    let aiReply = '';
    if (matchedProperties.length > 0) {
      aiReply = await geminiService.generatePropertyRecommendation({
        properties: matchedProperties,
        session: {
          name: fullName,
          propertyType,
          location: area,
          budget: { raw: budget, amount: budgetAmount },
        },
      });
    } else {
      aiReply = await geminiService.generateNoResultsResponse({
        name: fullName,
        propertyType,
        location: area,
        budget: { raw: budget, amount: budgetAmount },
      });
    }

    // Save lead to Google Sheets (fire-and-forget — don't block response)
    const sessionId = generateSessionId();
    const date = formatDateIN(new Date());
    const projectNames = formattedProps.map((p) => p.name).filter(Boolean).join(', ');

    const leadRow = [
      date,
      fullName,
      cleanedMobile,
      email || '',
      propertyType,
      area,
      budget,
      projectNames,
      'New Lead',
      `Landing Page Form — ${new Date().toLocaleTimeString('en-IN')}`,
    ];

    sheetsService.appendLead(leadRow).catch((err) => {
      logger.error('Lead save failed (quick-search):', err.message);
    });

    return res.json({
      success: true,
      sessionId,
      reply: aiReply,
      properties: formattedProps,
      total: formattedProps.length,
    });

  } catch (err) {
    next(err);
  }
});

// ── GET /api/hot-deals ────────────────────────────────────────────────────────
router.get('/hot-deals', async (req, res, next) => {
  try {
    logger.info('GET /hot-deals');

    const allProperties = await sheetsService.getProperties(false);

    // Filter where Status column (case-insensitive) = "hot deal"
    const hotDeals = allProperties.filter(
      (p) => (p[COL.STATUS] || '').toLowerCase().trim() === 'hot deal'
    );

    const formatted = hotDeals.map(propertyService.formatProperty);

    return res.json({
      success: true,
      total: formatted.length,
      properties: formatted,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
