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

// ── POST /api/refine-search ───────────────────────────────────────────────────
// User wants to change budget/area/type after seeing initial results
router.post('/refine-search', async (req, res, next) => {
  try {
    const { message, fullName, chatHistory = [] } = req.body;
    let { currentCriteria } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'message required' });
    }
    currentCriteria = currentCriteria || {};

    // Use Gemini to extract updated criteria from user message
    const historyContext = chatHistory.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');
    const extractPrompt = `
User wants to chat or refine their property search.
Current search criteria: ${JSON.stringify(currentCriteria)}
Recent Chat:
${historyContext}

User said: "${message}"

Extract the intent and any updates from the user message. Return ONLY valid JSON:
{
  "intent": "search" | "chat", // IMPORTANT: "chat" if the user is replying to a previous question, clicking/asking about a specific property mentioned in the chat, saying hello, or asking to visit/call. ONLY use "search" if the user explicitly wants to search a DIFFERENT area, DIFFERENT budget, or DIFFERENT property type!
  "propertyType": "<same or updated>",
  "budget": "<same or updated>",
  "area": "<same or updated>",
  "showMore": <true if user wants more results, false otherwise>
}
If a field is not mentioned, keep the current value.
JSON ONLY:`;

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const config = require('../config/env');
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const gModel = genAI.getGenerativeModel({ model: config.geminiModel });
    const aiResult = await gModel.generateContent(extractPrompt);
    const aiText = aiResult.response.text().trim();

    let updatedCriteria = { ...currentCriteria };
    let intent = "search";
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        intent = parsed.intent || "search";
        updatedCriteria = { ...currentCriteria, ...parsed };
      }
    } catch (e) { /* keep current */ }

    const gemini = require('../services/geminiService');
    const { searchProperties, formatProperty } = require('../services/propertyService');
    
    let matchedProperties = [];
    let formattedProps = [];
    let aiReply = '';

    if (intent === "search") {
      // Search with updated criteria
      matchedProperties = await searchProperties({
        propertyType: updatedCriteria.propertyType,
        location: updatedCriteria.area,
        budget: updatedCriteria.budget,
        forceRefresh: true,
      });

      formattedProps = matchedProperties.map(formatProperty);

      if (formattedProps.length > 0) {
        aiReply = await gemini.generatePropertyRecommendation({
          properties: matchedProperties,
          session: {
            name: fullName || 'there',
            propertyType: updatedCriteria.propertyType,
            location: updatedCriteria.area,
            budget: { raw: updatedCriteria.budget },
          },
          userMessage: message,
          chatHistory: chatHistory
        });
      } else {
        aiReply = await gemini.generateNoResultsResponse({
          name: fullName || 'there',
          propertyType: updatedCriteria.propertyType,
          location: updatedCriteria.area,
          budget: { raw: updatedCriteria.budget },
        }, message, chatHistory);
      }
    } else {
      // Intent is Chat - Answer directly without re-searching
      aiReply = await gemini.generateChatResponse({
        session: {
          name: fullName || 'there',
          propertyType: updatedCriteria.propertyType,
          location: updatedCriteria.area,
          budget: { raw: updatedCriteria.budget },
        },
        userMessage: message,
        chatHistory: chatHistory
      });
    }

    return res.json({
      success: true,
      reply: aiReply,
      properties: formattedProps,
      total: formattedProps.length,
      updatedCriteria,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/hot-deal-interest ───────────────────────────────────────────────
// User is interested in a Hot Deal property — capture lead + AI opening
router.post('/hot-deal-interest', async (req, res, next) => {
  try {
    const { fullName, mobile, propertyId, propertyName, propertyLocation, propertyBudget } = req.body;

    if (!fullName || !mobile || !propertyName) {
      return res.status(400).json({ success: false, error: 'fullName, mobile, propertyName required' });
    }

    const cleanedMobile = mobile.replace(/[\s\-()]/g, '');
    const { isValidIndianMobile, formatDateIN, generateSessionId } = require('../utils/helpers');
    if (!isValidIndianMobile(cleanedMobile)) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit Indian mobile required' });
    }

    // Save lead to Google Sheets
    const { appendLead } = require('../services/sheetsService');
    const date = formatDateIN(new Date());
    const leadRow = [
      date,
      fullName,
      cleanedMobile,
      '',
      'Hot Deal Inquiry',
      propertyLocation || '',
      propertyBudget || '',
      propertyName,
      'Hot Deal Lead',
      `Hot Deal interest — ${propertyName}`,
    ];
    appendLead(leadRow).catch((err) => logger.error('Hot deal lead save failed:', err.message));

    // Generate AI opening message
    const config = require('../config/env');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const gModel = genAI.getGenerativeModel({ model: config.geminiModel });

    const aiPrompt = `You are Priya, a warm AI property advisor for JaipurPropIQ Jaipur.
${fullName} is interested in: ${propertyName} at ${propertyLocation} (${propertyBudget}).
Write a SHORT excited 2-sentence welcome message + ask ONE follow-up question about their preferred timeline or budget. No markdown. 40 words max.`;

    const aiResult = await gModel.generateContent(aiPrompt);
    const aiReply = aiResult.response.text().trim();

    return res.json({
      success: true,
      sessionId: generateSessionId(),
      reply: aiReply,
      message: 'Lead saved! Our expert will call you within 24 hours.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
