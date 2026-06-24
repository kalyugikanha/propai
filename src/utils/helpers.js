/**
 * General helper utilities for PropAI backend.
 */

/**
 * Generate a unique session ID (UUID v4 via crypto, no external deps needed here
 * since uuid package is available; this is a fallback-safe version).
 */
const { v4: uuidv4 } = require('uuid');

const generateSessionId = () => uuidv4();

/**
 * Sanitize a string for safe use in prompts / logs (remove control chars).
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
const sanitizeString = (str, maxLength = 500) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/[\u0000-\u001F\u007F]/g, ' ') // strip control characters
    .trim()
    .slice(0, maxLength);
};

/**
 * Validate an Indian mobile number (starts with 6-9, exactly 10 digits).
 * @param {string} mobile
 * @returns {boolean}
 */
const isValidIndianMobile = (mobile) => {
  if (!mobile) return false;
  const cleaned = mobile.toString().replace(/\s|-/g, '');
  return /^[6-9]\d{9}$/.test(cleaned);
};

/**
 * Extract first name from a full name string.
 * @param {string} fullName
 * @returns {string}
 */
const getFirstName = (fullName) => {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0];
};

/**
 * Format a Date object to dd/mm/yyyy string (Indian format).
 * @param {Date} date
 * @returns {string}
 */
const formatDateIN = (date = new Date()) => {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Safe JSON parse — returns null on error.
 * @param {string} str
 * @returns {object|null}
 */
const safeJsonParse = (str) => {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

/**
 * Strip markdown formatting from a string (for plain-text output).
 * @param {string} text
 * @returns {string}
 */
const stripMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // bold
    .replace(/\*(.*?)\*/g, '$1')      // italic
    .replace(/`(.*?)`/g, '$1')        // inline code
    .replace(/#{1,6}\s/g, '')         // headings
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .trim();
};

module.exports = {
  generateSessionId,
  sanitizeString,
  isValidIndianMobile,
  getFirstName,
  formatDateIN,
  safeJsonParse,
  stripMarkdown,
};
