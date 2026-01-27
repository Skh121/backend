import Session from '../models/Session.js';
import crypto from 'crypto';

/**
 * Parse user agent string to extract device information
 * @param {string} userAgent - User agent string
 * @returns {object} - Device info
 */
export const parseUserAgent = (userAgent) => {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Unknown',
    };
  }

  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Desktop';

  // Detect browser
  if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  else if (userAgent.includes('Opera') || userAgent.includes('OPR')) browser = 'Opera';

  // Detect OS
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

  // Detect device type
  if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
    device = 'Mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    device = 'Tablet';
  }

  return { browser, os, device };
};

/**
 * Generate session token
 * @returns {string} - Session token
 */
export const generateSessionToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create new session
 * @param {object} params - Session parameters
 * @returns {Promise<Session>} - Created session
 */
export const createSession = async ({
  userId,
  refreshTokenHash,
  ip,
  userAgent,
  expiresAt,
}) => {
  const sessionToken = generateSessionToken();
  const deviceInfo = parseUserAgent(userAgent);

  const session = await Session.create({
    userId,
    sessionToken,
    refreshTokenHash,
    deviceInfo: {
      userAgent,
      ...deviceInfo,
    },
    ip,
    expiresAt,
    lastActivity: new Date(),
  });

  return session;
};

/**
 * Update session activity
 * @param {string} sessionToken - Session token
 */
export const updateSessionActivity = async (sessionToken) => {
  const session = await Session.findOne({ sessionToken, isActive: true });

  if (session) {
    await session.updateActivity();
  }
};

/**
 * Revoke session
 * @param {string} sessionToken - Session token
 */
export const revokeSession = async (sessionToken) => {
  const session = await Session.findOne({ sessionToken });

  if (session) {
    await session.revoke();
  }
};

/**
 * Get session by token
 * @param {string} sessionToken - Session token
 * @returns {Promise<Session|null>} - Session or null
 */
export const getSessionByToken = async (sessionToken) => {
  return await Session.findOne({
    sessionToken,
    isActive: true,
    expiresAt: { $gt: new Date() },
  });
};

/**
 * Verify session
 * @param {string} sessionToken - Session token
 * @param {string} refreshToken - Refresh token to verify
 * @returns {Promise<boolean>} - Whether session is valid
 */
export const verifySession = async (sessionToken, refreshToken) => {
  const session = await getSessionByToken(sessionToken);

  if (!session) {
    return false;
  }

  const bcrypt = (await import('bcrypt')).default;
  const isValid = await bcrypt.compare(refreshToken, session.refreshTokenHash);

  if (isValid) {
    await updateSessionActivity(sessionToken);
  }

  return isValid;
};

export default {
  parseUserAgent,
  generateSessionToken,
  createSession,
  updateSessionActivity,
  revokeSession,
  getSessionByToken,
  verifySession,
};
