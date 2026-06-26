/**
 * Email Service — OTP sending via Gmail SMTP
 */
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// In-memory OTP store: email -> { otp, expires, verified }
const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const getTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
};

/**
 * Generate 6-digit OTP
 */
const generateOTP = () => String(Math.floor(100000 + Math.random() * 900000));

/**
 * Send OTP to email
 * @param {string} email
 * @param {string} name
 * @returns {Promise<boolean>}
 */
const sendOTP = async (email, name) => {
  const otp = generateOTP();
  const expires = Date.now() + OTP_EXPIRY_MS;

  // Store OTP
  otpStore.set(email.toLowerCase(), { otp, expires, verified: false, attempts: 0 });

  const transporter = getTransporter();

  const mailOptions = {
    from: `"JaipurPropIQ" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `${otp} — Your JaipurPropIQ Verification Code`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #8B1C1C, #C0392B); padding: 32px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🏠 JaipurPropIQ</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">AI Property Assistant</p>
        </div>
        <div style="padding: 32px;">
          <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 8px;">Hi ${name || 'there'},</p>
          <p style="color: #4A4A4A; margin: 0 0 24px;">Apni property search shuru karne ke liye ye verification code use karein:</p>
          <div style="background: #FDF8F5; border: 2px solid #8B1C1C; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
            <div style="font-size: 42px; font-weight: 800; color: #8B1C1C; letter-spacing: 8px;">${otp}</div>
            <p style="color: #888; font-size: 13px; margin: 8px 0 0;">Valid for 5 minutes only</p>
          </div>
          <p style="color: #888; font-size: 13px; margin: 0;">If you did not request this, please ignore this email.</p>
        </div>
        <div style="background: #F8F4F4; padding: 16px; text-align: center;">
          <p style="color: #888; font-size: 12px; margin: 0;">GrowInsight Solutions LLP · Jaipur, Rajasthan · RERA Registered</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`OTP sent to ${email}`);
    return true;
  } catch (err) {
    logger.error('OTP email failed:', err.message);
    throw new Error('Email bhejne mein error. Please check email address.');
  }
};

/**
 * Verify OTP for email
 * @param {string} email
 * @param {string} otp
 * @returns {{ valid: boolean, reason?: string }}
 */
const verifyOTP = (email, otp) => {
  const record = otpStore.get(email.toLowerCase());

  if (!record) return { valid: false, reason: 'OTP nahi mila. Dobara send karo.' };
  if (Date.now() > record.expires) {
    otpStore.delete(email.toLowerCase());
    return { valid: false, reason: 'OTP expire ho gaya. Dobara bhejo.' };
  }
  if (record.attempts >= 3) {
    otpStore.delete(email.toLowerCase());
    return { valid: false, reason: '3 baar galat OTP. Dobara send karo.' };
  }
  if (record.otp !== String(otp).trim()) {
    record.attempts++;
    return { valid: false, reason: `Galat OTP. ${3 - record.attempts} try bacha hai.` };
  }

  // Mark verified
  record.verified = true;
  return { valid: true };
};

/**
 * Check if email is already verified (for re-use within session)
 */
const isVerified = (email) => {
  const record = otpStore.get(email.toLowerCase());
  return record?.verified === true && Date.now() <= record.expires;
};

module.exports = { sendOTP, verifyOTP, isVerified };
