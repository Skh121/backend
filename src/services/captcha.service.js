import axios from 'axios';
import { logger } from '../utils/logger.js';
import { securityConfig } from '../config/security.js';

/**
 * Verify reCAPTCHA token
 * @param {string} token - reCAPTCHA token from frontend
 * @param {string} remoteip - User's IP address
 * @returns {Promise<object>} Verification result
 */
export const verifyCaptcha = async (token, remoteip) => {
  try {
    const isPlaceholder = !process.env.RECAPTCHA_SECRET_KEY ||
                         process.env.RECAPTCHA_SECRET_KEY === 'your_recaptcha_secret_key' ||
                         process.env.RECAPTCHA_SECRET_KEY.startsWith('your_');

    if (isPlaceholder) {
      logger.warn('reCAPTCHA secret key not configured or is placeholder');
      // In development, allow without CAPTCHA
      if (process.env.NODE_ENV === 'development') {
        logger.info('CAPTCHA verification bypassed in development mode');
        return { success: true, score: 1.0 };
      }
      return { success: false, score: 0 };
    }

    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: token,
          remoteip,
        },
      }
    );

    const { success, score, 'error-codes': errorCodes } = response.data;

    if (!success) {
      logger.warn('CAPTCHA verification failed:', { errorCodes, remoteip });
      return { success: false, score: 0, errorCodes };
    }

    // For reCAPTCHA v3, check score threshold
    if (score !== undefined && score < securityConfig.captcha.scoreThreshold) {
      logger.warn('CAPTCHA score below threshold:', { score, remoteip });
      return { success: false, score, reason: 'score_too_low' };
    }

    logger.info('CAPTCHA verification successful:', { score, remoteip });
    return { success: true, score };
  } catch (error) {
    logger.error('Error verifying CAPTCHA:', error.message);
    // Fail closed - reject on error
    return { success: false, score: 0, error: error.message };
  }
};

/**
 * Middleware to verify CAPTCHA token
 */
export const verifyCaptchaMiddleware = async (req, res, next) => {
  try {
    // In development mode without reCAPTCHA configured, bypass entirely
    const isPlaceholder = !process.env.RECAPTCHA_SECRET_KEY ||
                         process.env.RECAPTCHA_SECRET_KEY === 'your_recaptcha_secret_key' ||
                         process.env.RECAPTCHA_SECRET_KEY.startsWith('your_');

    if (process.env.NODE_ENV === 'development' && isPlaceholder) {
      logger.info('CAPTCHA verification bypassed in development mode (no valid secret key)');
      delete req.body.captchaToken;
      return next();
    }

    const token = req.body.captchaToken;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'CAPTCHA token is required',
      });
    }

    const result = await verifyCaptcha(token, req.ip);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'CAPTCHA verification failed',
      });
    }

    // Remove captcha token from body
    delete req.body.captchaToken;

    next();
  } catch (error) {
    logger.error('CAPTCHA middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'CAPTCHA verification error',
    });
  }
};

export default { verifyCaptcha, verifyCaptchaMiddleware };
