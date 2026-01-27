import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * Generate TOTP secret
 * @param {string} userEmail - User's email for labeling
 * @returns {object} - Secret and otpauth URL
 */
export const generateTOTPSecret = (userEmail) => {
  const secret = speakeasy.generateSecret({
    name: `Shopping Platform (${userEmail})`,
    issuer: 'Shopping Platform',
    length: 32,
  });

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
  };
};

/**
 * Generate QR code as data URL
 * @param {string} otpauthUrl - OTP auth URL
 * @returns {Promise<string>} - QR code data URL
 */
export const generateQRCode = async (otpauthUrl) => {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return qrCodeDataUrl;
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Verify TOTP token
 * @param {string} token - TOTP token from user
 * @param {string} secret - User's TOTP secret
 * @param {number} window - Time window (default: 1 = ±30 seconds)
 * @returns {boolean} - Whether token is valid
 */
export const verifyTOTPToken = (token, secret, window = 1) => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window,
  });
};

/**
 * Generate backup codes
 * @param {number} count - Number of backup codes to generate
 * @returns {string[]} - Array of backup codes
 */
export const generateBackupCodes = (count = 10) => {
  const codes = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    // Format as XXXX-XXXX
    const formattedCode = `${code.slice(0, 4)}-${code.slice(4, 8)}`;
    codes.push(formattedCode);
  }

  return codes;
};

/**
 * Hash backup code for storage
 * @param {string} code - Backup code to hash
 * @returns {Promise<string>} - Hashed code
 */
export const hashBackupCode = async (code) => {
  const bcrypt = (await import('bcrypt')).default;
  return bcrypt.hash(code, 10);
};

/**
 * Verify backup code
 * @param {string} code - Backup code from user
 * @param {string[]} hashedCodes - Array of hashed backup codes
 * @returns {Promise<object>} - { isValid, codeIndex }
 */
export const verifyBackupCode = async (code, hashedCodes) => {
  const bcrypt = (await import('bcrypt')).default;

  for (let i = 0; i < hashedCodes.length; i++) {
    const isValid = await bcrypt.compare(code, hashedCodes[i]);
    if (isValid) {
      return { isValid: true, codeIndex: i };
    }
  }

  return { isValid: false, codeIndex: -1 };
};

/**
 * Get current TOTP token (for testing)
 * @param {string} secret - User's TOTP secret
 * @returns {string} - Current TOTP token
 */
export const getCurrentTOTPToken = (secret) => {
  return speakeasy.totp({
    secret,
    encoding: 'base32',
  });
};

export default {
  generateTOTPSecret,
  generateQRCode,
  verifyTOTPToken,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  getCurrentTOTPToken,
};
