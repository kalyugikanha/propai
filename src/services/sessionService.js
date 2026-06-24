/**
 * Session Service
 * In-memory session store with TTL-based expiration.
 * Designed to be Redis-swappable: only get/set/delete methods are used externally.
 *
 * Session Schema:
 * {
 *   sessionId, createdAt, lastActivity, step,
 *   name, mobile, propertyType, location,
 *   budget: { raw, amount },
 *   recommendedProjects: [],
 *   leadSaved: false,
 *   messageHistory: []
 * }
 */

const { SESSION_TTL_MS, FLOW_STEPS } = require('../config/constants');
const logger = require('../utils/logger');

/** @type {Map<string, object>} */
const store = new Map();

// Run cleanup every 30 minutes
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  let expired = 0;
  for (const [id, session] of store.entries()) {
    if (now - new Date(session.lastActivity).getTime() > SESSION_TTL_MS) {
      store.delete(id);
      expired++;
    }
  }
  if (expired > 0) {
    logger.info(`Session cleanup: removed ${expired} expired sessions. Active: ${store.size}`);
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Create a fresh session.
 * @param {string} sessionId
 * @returns {object} session
 */
const createSession = (sessionId) => {
  const now = new Date().toISOString();
  const session = {
    sessionId,
    createdAt: now,
    lastActivity: now,
    step: FLOW_STEPS.COLLECT_NAME, // First step after the auto-greeting
    name: null,
    mobile: null,
    propertyType: null,
    location: null,
    budget: null,        // { raw: '50 lakhs', amount: 5000000 }
    recommendedProjects: [],
    leadSaved: false,
    messageHistory: [],
  };
  store.set(sessionId, session);
  logger.debug(`Session created: ${sessionId}`);
  return session;
};

/**
 * Retrieve a session by ID. Returns null if not found or expired.
 * @param {string} sessionId
 * @returns {object|null}
 */
const getSession = (sessionId) => {
  const session = store.get(sessionId);
  if (!session) return null;

  const now = Date.now();
  const lastActivity = new Date(session.lastActivity).getTime();
  if (now - lastActivity > SESSION_TTL_MS) {
    store.delete(sessionId);
    logger.debug(`Session expired: ${sessionId}`);
    return null;
  }

  return session;
};

/**
 * Update arbitrary fields on a session.
 * @param {string} sessionId
 * @param {object} updates
 * @returns {object|null} updated session
 */
const updateSession = (sessionId, updates) => {
  const session = getSession(sessionId);
  if (!session) return null;
  Object.assign(session, updates);
  store.set(sessionId, session);
  return session;
};

/**
 * Advance the conversation step.
 * @param {string} sessionId
 * @param {string} step  - one of FLOW_STEPS values
 */
const updateStep = (sessionId, step) => {
  return updateSession(sessionId, { step });
};

/**
 * Touch the lastActivity timestamp (call on every request).
 * @param {string} sessionId
 */
const updateActivity = (sessionId) => {
  const session = store.get(sessionId);
  if (session) {
    session.lastActivity = new Date().toISOString();
  }
};

/**
 * Delete a session explicitly.
 * @param {string} sessionId
 */
const deleteSession = (sessionId) => {
  store.delete(sessionId);
};

/**
 * Return how many sessions are currently active (for monitoring).
 * @returns {number}
 */
const activeSessionCount = () => store.size;

/**
 * Append a message to the session history (max 50 messages kept).
 * @param {string} sessionId
 * @param {'user'|'assistant'} role
 * @param {string} content
 */
const addMessage = (sessionId, role, content) => {
  const session = getSession(sessionId);
  if (!session) return;
  session.messageHistory.push({ role, content, timestamp: new Date().toISOString() });
  // Keep last 50 messages to avoid unbounded growth
  if (session.messageHistory.length > 50) {
    session.messageHistory = session.messageHistory.slice(-50);
  }
};

module.exports = {
  createSession,
  getSession,
  updateSession,
  updateStep,
  updateActivity,
  deleteSession,
  addMessage,
  activeSessionCount,
};
