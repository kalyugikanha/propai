const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');
const { generateSessionId } = require('../utils/helpers');
const { validateChat, validateChatStart } = require('../middleware/validator');
const logger = require('../utils/logger');

/**
 * POST /api/chat/start
 * Called when the widget opens. Returns the greeting message.
 * Creates a new session or restores an existing one.
 */
router.post('/chat/start', validateChatStart, async (req, res, next) => {
  try {
    const sessionId = req.body.sessionId || generateSessionId();
    const response = chatService.startSession(sessionId);

    return res.json({
      success: true,
      sessionId,
      ...response,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/chat
 * Main chat endpoint. Receives a user message and returns the bot's response.
 *
 * Request body: { sessionId: string, message: string }
 * Response:     { success, sessionId, reply, step, quickReplies, properties }
 */
router.post('/chat', validateChat, async (req, res, next) => {
  try {
    const { message } = req.body;
    const sessionId = req.body.sessionId || generateSessionId();

    logger.info(`POST /chat | session=${sessionId} | message="${message.slice(0, 60)}"`);

    const response = await chatService.processMessage(sessionId, message);

    return res.json({
      success: true,
      sessionId,
      ...response,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
