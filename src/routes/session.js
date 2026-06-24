const express = require('express');
const router = express.Router();
const sessionService = require('../services/sessionService');
const { validateSessionId } = require('../middleware/validator');

/**
 * GET /api/session/:sessionId
 * Retrieve the current state of a session (for debugging or widget state restoration).
 * Sensitive fields (mobile) are masked in the response.
 */
router.get('/session/:sessionId', validateSessionId, (req, res) => {
  const { sessionId } = req.params;

  const session = sessionService.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found or expired.',
    });
  }

  // Mask mobile number for security
  const safeSession = {
    ...session,
    mobile: session.mobile
      ? `${session.mobile.slice(0, 3)}****${session.mobile.slice(-3)}`
      : null,
    messageHistory: undefined, // Don't expose full history via API
  };

  return res.json({
    success: true,
    activeSessionCount: sessionService.activeSessionCount(),
    session: safeSession,
  });
});

/**
 * DELETE /api/session/:sessionId
 * Explicitly delete a session (e.g., when user closes widget permanently).
 */
router.delete('/session/:sessionId', validateSessionId, (req, res) => {
  const { sessionId } = req.params;
  sessionService.deleteSession(sessionId);
  return res.json({ success: true, message: 'Session deleted.' });
});

module.exports = router;
