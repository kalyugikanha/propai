/**
 * Budget Parser Utility
 * Converts natural language Indian budget strings to numeric INR values.
 *
 * Supports:
 *   "20 lakhs"   → 2,000,000
 *   "1 crore"    → 10,000,000
 *   "1.5 cr"     → 15,000,000
 *   "80L"        → 8,000,000
 *   "50 lacs"    → 5,000,000
 *   "2.5 crore"  → 25,000,000
 *   "500000"     → 500,000 (raw number passthrough)
 *   "5 Crore+"   → 50,000,000 (treats + as exact value)
 */

const CRORE_MULTIPLIER = 10_000_000;
const LAKH_MULTIPLIER = 100_000;
const THOUSAND_MULTIPLIER = 1_000;

/**
 * Parse a natural language budget string to a number (INR).
 * Returns null if the string cannot be parsed.
 * @param {string|number} text
 * @returns {number|null}
 */
const parse = (text) => {
  if (text === null || text === undefined) return null;
  if (typeof text === 'number' && !isNaN(text)) return text;

  const str = text
    .toString()
    .toLowerCase()
    .replace(/,/g, '')           // remove commas
    .replace(/rs\.?\s*/g, '')    // remove "Rs" prefix
    .replace(/₹/g, '')           // remove rupee symbol
    .replace(/\+/g, '')          // remove "+" (e.g. "5 Crore+")
    .trim();

  // Determine multiplier from unit keyword
  let multiplier = 1;

  if (/crore|cr\b/.test(str)) {
    multiplier = CRORE_MULTIPLIER;
  } else if (/lakh|lac|l\b/.test(str)) {
    multiplier = LAKH_MULTIPLIER;
  } else if (/thousand|k\b/.test(str)) {
    multiplier = THOUSAND_MULTIPLIER;
  }

  // Extract the numeric part
  const numMatch = str.match(/(\d+\.?\d*)/);
  if (!numMatch) return null;

  const value = parseFloat(numMatch[1]);
  if (isNaN(value)) return null;

  return Math.round(value * multiplier);
};

/**
 * Format a numeric INR value to a human-readable string.
 * @param {number} amount
 * @returns {string}
 */
const format = (amount) => {
  if (!amount || isNaN(amount)) return 'N/A';

  if (amount >= CRORE_MULTIPLIER) {
    const crore = amount / CRORE_MULTIPLIER;
    return `${crore % 1 === 0 ? crore : crore.toFixed(2)} Crore`;
  }
  if (amount >= LAKH_MULTIPLIER) {
    const lakh = amount / LAKH_MULTIPLIER;
    return `${lakh % 1 === 0 ? lakh : lakh.toFixed(1)} Lakh`;
  }
  if (amount >= THOUSAND_MULTIPLIER) {
    const k = amount / THOUSAND_MULTIPLIER;
    return `${k % 1 === 0 ? k : k.toFixed(1)}K`;
  }
  return amount.toLocaleString('en-IN');
};

/**
 * Check if a numeric budget falls within a [min, max] range.
 * Handles empty/missing min or max gracefully.
 * @param {number} budget
 * @param {string|number} minBudget
 * @param {string|number} maxBudget
 * @returns {boolean}
 */
const isWithinRange = (budget, minBudget, maxBudget) => {
  const min = parseInt(minBudget) || 0;
  const max = parseInt(maxBudget) || Infinity;
  return budget >= min && budget <= max;
};

module.exports = { parse, format, isWithinRange };
