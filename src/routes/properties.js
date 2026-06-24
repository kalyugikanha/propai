const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheetsService');
const propertyService = require('../services/propertyService');
const { validateSearchProperties } = require('../middleware/validator');
const logger = require('../utils/logger');

/**
 * GET /api/properties
 * Returns all active properties from the cache (or live from Sheets if stale).
 * Use ?refresh=true to force a cache bypass.
 */
router.get('/properties', async (req, res, next) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const raw = await sheetsService.getProperties(forceRefresh);

    // Return formatted properties
    const properties = raw.map(propertyService.formatProperty);
    const cacheStats = sheetsService.getCacheStats();

    return res.json({
      success: true,
      total: properties.length,
      cachedAt: cacheStats.cachedAt,
      cached: cacheStats.cached,
      properties,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/search-properties
 * Perform a filtered property search without going through the chat flow.
 * Useful for testing or external integrations.
 *
 * Request body: { propertyType?, location?, budget? }
 */
router.post('/search-properties', validateSearchProperties, async (req, res, next) => {
  try {
    const { propertyType, location, budget } = req.body;

    logger.info(`POST /search-properties | type=${propertyType} loc=${location} budget=${budget}`);

    const results = await propertyService.searchProperties({ propertyType, location, budget });
    const formatted = results.map(propertyService.formatProperty);

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
