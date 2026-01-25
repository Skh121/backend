import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

let transporter = null;

/**
 * Initialize email transporter
 */
const initializeTransporter = () => {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    logger.info('Email transporter initialized');
  } catch (error) {
    logger.error('Error initializing email transporter:', error);
  }
};

/**
 * Send email
 * @param {object} options - Email options (to, subject, html, text)
 * @returns {Promise<boolean>} Success status
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    if (!transporter) {
      initializeTransporter();
    }

    if (!transporter) {
      logger.warn('Email transporter not configured');
      // In development, log email instead of sending
      if (process.env.NODE_ENV === 'development') {
        logger.info(`Email (Development Mode):\nTo: ${to}\nSubject: ${subject}\nContent: ${text || html}`);
        return true;
      }
      return false;
    }

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Shopping Platform'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error('Error sending email:', error);
    return false;
  }
};

/**
 * Send verification email with PIN
 * @param {string} email - Recipient email
 * @param {string} pin - 6-digit verification PIN
 * @returns {Promise<boolean>} Success status
 */
export const sendVerificationEmail = async (email, pin) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; border-radius: 10px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h2 style="color: white; margin: 0;">🛍️ Verify Your Email</h2>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Thank you for registering with ShopSecure!</p>
        <p style="font-size: 16px; color: #333;">Your verification PIN is:</p>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 10px; letter-spacing: 8px; margin: 20px 0;">
          ${pin}
        </div>
        <p style="font-size: 14px; color: #666;">This PIN will expire in 10 minutes.</p>
        <p style="font-size: 14px; color: #666; margin-top: 20px;">If you didn't request this, please ignore this email.</p>
      </div>
    </div>
  `;

  const text = `
    Verify Your Email Address

    Thank you for registering with ShopSecure!

    Your verification PIN is: ${pin}

    This PIN will expire in 10 minutes.

    If you didn't create an account, please ignore this email.
  `;

  return sendEmail({
    to: email,
    subject: 'Verify Your Email Address',
    html,
    text,
  });
};

/**
 * Send 2FA code email
 * @param {string} email - Recipient email
 * @param {string} code - 2FA code
 * @returns {Promise<boolean>} Success status
 */
export const send2FACode = async (email, code) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Your Two-Factor Authentication Code</h2>
      <p>Your 2FA verification code is:</p>
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 4px; margin: 16px 0;">
        ${code}
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this code, please ignore this email and ensure your account is secure.</p>
    </div>
  `;

  const text = `
    Your Two-Factor Authentication Code

    Your 2FA verification code is: ${code}

    This code will expire in 10 minutes.

    If you didn't request this code, please ignore this email and ensure your account is secure.
  `;

  return sendEmail({
    to: email,
    subject: 'Your 2FA Verification Code',
    html,
    text,
  });
};

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} token - Reset token
 * @returns {Promise<boolean>} Success status
 */
export const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Reset Your Password</h2>
      <p>You requested to reset your password. Click the button below to proceed:</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
        Reset Password
      </a>
      <p>Or copy and paste this link into your browser:</p>
      <p style="color: #666; word-break: break-all;">${resetUrl}</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request a password reset, please ignore this email and ensure your account is secure.</p>
    </div>
  `;

  const text = `
    Reset Your Password

    You requested to reset your password. Please visit the following link to proceed:
    ${resetUrl}

    This link will expire in 1 hour.

    If you didn't request a password reset, please ignore this email and ensure your account is secure.
  `;

  return sendEmail({
    to: email,
    subject: 'Reset Your Password',
    html,
    text,
  });
};

export default { sendEmail, sendVerificationEmail, send2FACode, sendPasswordResetEmail };
