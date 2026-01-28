import { verifyAccessToken } from "../services/token.service.js";
import { HTTP_STATUS, ERROR_MESSAGES, USER_ROLES, SUCCESS_MESSAGES } from "../utils/constants.js";
import User from "../models/User.js";
import { securityConfig } from "../config/security.js";
import { logger } from "../utils/logger.js";
import Session from "../models/Session.js";

/**
 * Authentication middleware - verifies JWT access token
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.UNAUTHORIZED,
      });
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Idle Session Check
    const sessionToken = req.cookies?.sessionToken;
    if (!sessionToken) {
      // If session tracking is enabled but token is missing, treat as unauthorized
      // (This ensures consistency once we start enforcing it)
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Session token missing. Please log in again.",
      });
    }

    const session = await Session.findOne({ sessionToken, isActive: true });
    if (!session) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Invalid or expired session. Please log in again.",
      });
    }

    // Check for idle timeout
    const now = new Date();
    const idleTime = now - session.lastActivity;

    if (idleTime > securityConfig.jwt.sessionIdleTimeout) {
      session.isActive = false;
      await session.save();

      // Clear cookies
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      res.clearCookie("sessionToken");

      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Session expired due to inactivity. Please log in again.",
        code: "SESSION_IDLE_TIMEOUT",
      });
    }

    // Update last activity
    await session.updateActivity();

    // Attach user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      sessionToken: sessionToken, // Useful for logout
    };

    next();
  } catch (error) {
    logger.error("Authentication error:", error.message);

    if (error.message === "Access token expired") {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Token expired",
        code: "TOKEN_EXPIRED",
      });
    }

    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: ERROR_MESSAGES.INVALID_TOKEN,
    });
  }
};

/**
 * Authorization middleware - checks user role
 * @param  {...string} allowedRoles - Roles allowed to access the route
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.UNAUTHORIZED,
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn("Authorization failed:", {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
      });

      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.FORBIDDEN,
      });
    }

    next();
  };
};

/**
 * Optional authentication - attaches user if token is valid, but doesn't require it
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      const decoded = verifyAccessToken(token);
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };
    }
  } catch (error) {
    // Don't fail if token is invalid, just proceed without user
    logger.debug("Optional auth - invalid token:", error.message);
  }

  next();
};

/**
 * Admin-only middleware
 */
export const adminOnly = [authenticate, authorize(USER_ROLES.ADMIN)];

/**
 * Check if user's password is expired
 * Should be used after authenticate middleware
 */
export const checkPasswordExpiry = async (req, res, next) => {
  try {
    // Skip check for password change routes
    if (req.path.includes("/change-password")) {
      return next();
    }

    if (!req.user || !req.user.id) {
      return next();
    }

    const user = await User.findById(req.user.id).select("+passwordExpiresAt");

    if (!user) {
      return next();
    }

    // Check if password is expired
    if (user.isPasswordExpired()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message:
          "Your password has expired. Please change your password to continue.",
        code: "PASSWORD_EXPIRED",
        data: {
          passwordExpiredAt: user.passwordExpiresAt,
        },
      });
    }

    // Check if password is expiring soon (warning)
    const daysUntilExpiry = user.getDaysUntilPasswordExpiry();
    if (
      daysUntilExpiry !== null &&
      daysUntilExpiry <= securityConfig.password.expiryWarningDays
    ) {
      // Add warning to response headers (frontend can show notification)
      res.setHeader("X-Password-Expiry-Warning", "true");
      res.setHeader("X-Password-Expiry-Days", daysUntilExpiry.toString());
    }

    next();
  } catch (error) {
    logger.error("Password expiry check error:", error.message);
    // Don't block the request on error, just proceed
    next();
  }
};
