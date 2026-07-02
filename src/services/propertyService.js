/**
 * Property Search Service
 * Implements the property matching algorithm:
 *   1. Filter: Active status only
 *   2. Filter: Property type match
 *   3. Filter: Location match (partial)
 *   4. Filter: Budget within Min–Max range
 *   5. Score: Rank by relevance
 *   6. Return top N results
 */

const sheetsService = require('./sheetsService');
const { parse: parseBudget, isWithinRange } = require('../utils/budgetParser');
const { PROPERTY_STATUS_ACTIVE, PROPERTY_COLUMNS: COL } = require('../config/constants');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Score a single property against the user's requirements.
 * Higher = better match.
 *
 * @param {object} property
 * @param {object} criteria - { propertyType, location, budgetAmount }
 * @returns {number}
 */
const scoreProperty = (property, { propertyType, location, budgetAmount }) => {
  let score = 0;

  // Exact location match (e.g. "Jagatpura")
  const propLocation = (property[COL.LOCATION] || '').toLowerCase();
  const searchLocation = (location || '').toLowerCase();

  if (searchLocation && propLocation === searchLocation) {
    score += 3;
  } else if (searchLocation && propLocation.includes(searchLocation)) {
    score += 1;
  }

  // Budget proximity: bonus if user budget is near the center of [min, max]
  if (budgetAmount) {
    const rawBudget = property[COL.BUDGET] || '';
    const parts = rawBudget.toLowerCase().split('to');
    const minB = parseBudget(parts[0]) || 0;
    const maxB = parseBudget(parts[1] || parts[0]) || budgetAmount;
    const center = (minB + maxB) / 2;
    const deviation = Math.abs(budgetAmount - center);
    const range = maxB - minB || 1;
    if (deviation / range < 0.1) {
      score += 2; // within 10% of range center
    } else if (deviation / range < 0.3) {
      score += 1;
    }
  }

  // Exact property type match
  let propType = (property[COL.PROPERTY_TYPE] || '').toLowerCase();
  if (propType.includes('flat')) propType = 'apartment';
  const searchType = (propertyType || '').toLowerCase();
  if (searchType && propType.includes(searchType)) {
    score += 1;
  }

  return score;
};

/**
 * Main search function.
 *
 * @param {object} criteria
 * @param {string} criteria.propertyType   - e.g. "Villa"
 * @param {string} criteria.location       - e.g. "Jagatpura"
 * @param {number|string} criteria.budget  - numeric amount OR raw string
 * @param {boolean} [criteria.forceRefresh] - bypass Sheets cache
 * @returns {Promise<object[]>} matched and scored properties
 */
const searchProperties = async ({ propertyType, location, budget, forceRefresh = false }) => {
  logger.info(`Property search: type="${propertyType}" location="${location}" budget="${budget}"`);

  const allProperties = await sheetsService.getProperties(forceRefresh);

  // Resolve budget to a number
  const budgetAmount = typeof budget === 'number' ? budget : parseBudget(budget);

  // ── Step 1: Active only ────────────────────────────────────────────────────
  let results = allProperties.filter(
    (p) => (p[COL.STATUS] || '').toLowerCase() === PROPERTY_STATUS_ACTIVE.toLowerCase()
  );

  // ── Step 2: Property type filter ──────────────────────────────────────────
  if (propertyType) {
    results = results.filter((p) => {
      let pType = (p[COL.PROPERTY_TYPE] || '').toLowerCase();
      if (pType.includes('flat')) pType = 'apartment';
      return pType.includes(propertyType.toLowerCase());
    });
  }

  // ── Step 3: Location filter — skip if 'any area' or similar ────────────────
  const ANY_AREA_KEYWORDS = ['any', 'anywhere', 'all', 'jaipur', 'any area', 'any area in jaipur', 'anywhere in jaipur'];
  const isAnyArea = !location || ANY_AREA_KEYWORDS.includes(location.toLowerCase().trim());
  if (!isAnyArea) {
    const loc = location.toLowerCase();
    results = results.filter(
      (p) => (p[COL.LOCATION] || '').toLowerCase().includes(loc)
    );
  }

  // ── Step 4: Budget range filter ───────────────────────────────────────────
  if (budgetAmount) {
    results = results.filter((p) => {
      const rawBudget = p[COL.BUDGET] || '';
      const parts = rawBudget.toLowerCase().split('to');
      const min = parseBudget(parts[0]) || 0;
      const max = parseBudget(parts[1] || parts[0]) || Infinity;
      // Allow 20% flexibility on both sides
      return budgetAmount >= min * 0.8 && budgetAmount <= max * 1.2;
    });
  }

  // ── Step 5: Score and rank ────────────────────────────────────────────────
  const scored = results.map((p) => ({
    ...p,
    _score: scoreProperty(p, { propertyType, location, budgetAmount }),
  }));

  scored.sort((a, b) => b._score - a._score);

  // ── Step 6: Limit results ─────────────────────────────────────────────────
  const limit = config.topPropertiesLimit;
  const topResults = scored.slice(0, limit);

  logger.info(
    `Search complete: ${allProperties.length} total → ${results.length} matched → ${topResults.length} returned`
  );

  // Strip internal score field before returning
  return topResults.map(({ _score, ...p }) => p);
};

/**
 * Return a sanitized property object for API/Gemini consumption.
 * Exposes only user-facing fields.
 * @param {object} p  - raw property row from Sheets
 * @returns {object}
 */
const formatProperty = (p) => {
  let pType = p[COL.PROPERTY_TYPE] || '';
  if (pType.toLowerCase().includes('flat')) pType = 'Apartment';

  return {
    id: p[COL.PROJECT_ID] || '',
    name: p[COL.PROJECT_NAME] || '',
    location: p[COL.LOCATION] || '',
    type: pType,
    size: p[COL.SIZE_SQFT] ? `${p[COL.SIZE_SQFT]} sqft` : '',
    budget: p[COL.BUDGET] || '',
    brochureLink: p[COL.BROCHURE_LINK] || '',
    description: p[COL.DESCRIPTION] || '',
    status: p[COL.STATUS] || '',
  };
};

module.exports = { searchProperties, formatProperty };
