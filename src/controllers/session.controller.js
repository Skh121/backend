import Session from '../models/Session.js';
import { revokeSession } from '../services/session.service.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../utils/constants.js';
import { logAuthEvent } from '../services/audit.service.js';

/**
 * Get all active sessions for current user
 * GET /api/sessions
 */
export const getMySessions = async (req, res, next) => {
  try {
    const sessions = await Session.getActiveSessions(req.user.id);

    // Get current session token from cookie
    const currentSessionToken = req.cookies?.sessionToken;

    // Format sessions for response
    const formattedSessions = sessions.map((session) => ({
      id: session._id,
      deviceInfo: session.deviceInfo,
      ip: session.ip,
      location: session.location,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
      isCurrent: session.sessionToken === currentSessionToken,
      isTrusted: session.isTrusted,
    }));

    res.json({
      success: true,
      data: {
        sessions: formattedSessions,
        total: formattedSessions.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke a specific session
 * DELETE /api/sessions/:sessionId
 */
export const revokeSessionById = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Session not found',
      });
    }

    // Verify session belongs to the user
    if (session.userId.toString() !== req.user.id) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.FORBIDDEN,
      });
    }

    // Revoke session
    await session.revoke();

    await logAuthEvent('session_revoked', req, req.user, true, `Session ID: ${sessionId}`);

    res.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke all sessions except current
 * POST /api/sessions/revoke-all
 */
export const revokeAllSessions = async (req, res, next) => {
  try {
    const currentSessionToken = req.cookies?.sessionToken;

    await Session.revokeAllSessions(req.user.id, currentSessionToken);

    await logAuthEvent('all_sessions_revoked', req, req.user, true);

    res.json({
      success: true,
      message: 'All other sessions revoked successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get session statistics
 * GET /api/sessions/stats
 */
export const getSessionStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [activeSessions, totalSessions, suspiciousSessions] = await Promise.all([
      Session.countDocuments({
        userId,
        isActive: true,
        expiresAt: { $gt: new Date() },
      }),
      Session.countDocuments({ userId }),
      Session.countDocuments({
        userId,
        flaggedAsSuspicious: true,
        isActive: true,
      }),
    ]);

    // Get sessions by device type
    const sessionsByDevice = await Session.aggregate([
      {
        $match: {
          userId: userId,
          isActive: true,
          expiresAt: { $gt: new Date() },
        },
      },
      {
        $group: {
          _id: '$deviceInfo.device',
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        activeSessions,
        totalSessions,
        suspiciousSessions,
        sessionsByDevice: sessionsByDevice.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark session as trusted
 * POST /api/sessions/:sessionId/trust
 */
export const trustSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Session not found',
      });
    }

    // Verify session belongs to the user
    if (session.userId.toString() !== req.user.id) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.FORBIDDEN,
      });
    }

    session.isTrusted = true;
    await session.save();

    res.json({
      success: true,
      message: 'Session marked as trusted',
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getMySessions,
  revokeSessionById,
  revokeAllSessions,
  getSessionStats,
  trustSession,
};
