const express = require('express');
const router = express.Router();
const leadService = require('../services/leadService');
const sessionService = require('../services/sessionService');
const { validateSaveLead } = require('../middleware/validator');
const logger = require('../utils/logger');

/**
 * POST /api/save-lead
 * Manually trigger lead saving for a given sessionId.
 * Normally leads are saved automatically by chatService when the user confirms contact.
 * This endpoint can be used for retry or external triggers.
 *
 * Request body: { sessionId: string }
 */
router.post('/save-lead', validateSaveLead, async (req, res, next) => {
  try {
    const { sessionId } = req.body;

    const session = sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or expired.',
      });
    }

    if (!session.name || !session.mobile) {
      return res.status(400).json({
        success: false,
        error: 'Session is incomplete. Name and mobile are required to save a lead.',
      });
    }

    if (session.leadSaved) {
      return res.json({
        success: true,
        message: 'Lead was already saved.',
        alreadySaved: true,
      });
    }

    await leadService.saveLead(session);
    sessionService.updateSession(sessionId, { leadSaved: true });

    logger.info(`Lead manually saved for session: ${sessionId}`);

    return res.json({
      success: true,
      message: 'Lead saved successfully.',
      alreadySaved: false,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
