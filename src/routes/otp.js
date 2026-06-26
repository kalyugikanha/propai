/**
 * OTP Routes
 * POST /api/send-otp   — send OTP to email
 * POST /api/verify-otp — verify OTP
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: errors.array()[0].msg });
  }
  next();
};

// POST /api/send-otp
router.post(
  '/send-otp',
  [body('email').isEmail().withMessage('Valid email required'), body('name').optional().isString(), validate],
  async (req, res, next) => {
    try {
      const { email, name } = req.body;

      // If already verified in last 5 min, skip resend
      if (emailService.isVerified(email)) {
        return res.json({ success: true, message: 'Email already verified', alreadyVerified: true });
      }

      await emailService.sendOTP(email, name);
      return res.json({ success: true, message: 'OTP sent to ' + email });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/verify-otp
router.post(
  '/verify-otp',
  [body('email').isEmail(), body('otp').isLength({ min: 6, max: 6 }).withMessage('6-digit OTP required'), validate],
  async (req, res) => {
    const { email, otp } = req.body;
    const result = emailService.verifyOTP(email, otp);

    if (result.valid) {
      return res.json({ success: true, message: 'Email verified!' });
    } else {
      return res.status(400).json({ success: false, error: result.reason });
    }
  }
);

module.exports = router;
