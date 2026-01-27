import { logger } from "../utils/logger.js";
import AuditLog from "../models/AuditLog.js";

/**
 * Parse event type into category and action
 * @param {string} type - Event type (e.g., 'auth:login', 'admin:update_user')
 * @returns {object} - { category, action }
 */
const parseEventType = (type) => {
  if (type.includes(":")) {
    const [category, action] = type.split(":");
    return { category, action };
  }
  return { category: "security", action: type };
};

/**
 * Determine severity based on event details
 * @param {object} event - Event details
 * @returns {string} - Severity level
 */
const determineSeverity = (event) => {
  if (event.details?.success === false || !event.success) {
    if (
      event.type?.includes("failed_login") ||
      event.type?.includes("unauthorized")
    ) {
      return "warning";
    }
    if (event.type?.includes("suspended") || event.type?.includes("locked")) {
      return "error";
    }
  }
  if (event.type?.includes("admin:")) {
    return "info";
  }
  return "info";
};

/**
 * Log security event
 * @param {object} event - Event details
 */
export const logSecurityEvent = async (event) => {
  const {
    type,
    userId,
    email,
    ip,
    userAgent,
    details,
    method,
    path,
    sessionId,
  } = event;

  // Log to Winston
  logger.info("Security Event:", {
    type,
    userId,
    email,
    ip,
    userAgent,
    details,
    timestamp: new Date().toISOString(),
  });

  // Parse event type
  const { category, action } = parseEventType(type);
  const severity = determineSeverity({ ...event, type });

  // Save to database
  await AuditLog.createLog({
    category,
    action,
    severity,
    userId,
    userEmail: email,
    ip,
    userAgent,
    method,
    path,
    success: details?.success !== undefined ? details.success : true,
    errorMessage: details?.reason || details?.error,
    details,
    sessionId,
  });
};

/**
 * Log authentication event
 * @param {string} type - Event type (login, logout, register, etc.)
 * @param {object} req - Express request object
 * @param {object} user - User object
 * @param {boolean} success - Success status
 * @param {string} reason - Failure reason (if applicable)
 */
export const logAuthEvent = async (type, req, user, success, reason = null) => {
  await logSecurityEvent({
    type: `auth:${type}`,
    userId: user?._id || user?.id,
    email: user?.email,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    method: req.method,
    path: req.path,
    success,
    details: {
      success,
      reason,
    },
  });
};

/**
 * Log admin action
 * @param {string} action - Action performed
 * @param {object} req - Express request object
 * @param {object} target - Target of the action (user, product, order, etc.)
 * @param {object} changes - Changes made
 */
export const logAdminAction = async (action, req, target, changes = {}) => {
  const targetType = target?.constructor?.modelName || "unknown";
  const targetId = target?._id || target?.id;

  await logSecurityEvent({
    type: `admin:${action}`,
    userId: req.user.id,
    email: req.user.email,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    method: req.method,
    path: req.path,
    details: {
      action,
      targetType,
      targetId,
      changes,
    },
  });

  // Also save target info directly
  await AuditLog.createLog({
    category: "admin",
    action,
    severity: "info",
    userId: req.user.id,
    userEmail: req.user.email,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    method: req.method,
    path: req.path,
    success: true,
    targetType,
    targetId,
    changes,
  });
};

/**
 * Log failed login attempt
 * @param {string} email - Email address
 * @param {object} req - Express request object
 * @param {string} reason - Failure reason
 */
export const logFailedLogin = async (email, req, reason) => {
  await logSecurityEvent({
    type: "auth:failed_login",
    email,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    method: req.method,
    path: req.path,
    success: false,
    details: {
      reason,
    },
  });
};

/**
 * Log suspicious activity
 * @param {string} activity - Activity description
 * @param {object} req - Express request object
 * @param {object} details - Additional details
 */
export const logSuspiciousActivity = async (activity, req, details = {}) => {
  logger.warn("Suspicious Activity:", {
    activity,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    userId: req.user?.id,
    email: req.user?.email,
    path: req.path,
    method: req.method,
    details,
    timestamp: new Date().toISOString(),
  });

  await AuditLog.createLog({
    category: "security",
    action: "suspicious_activity",
    severity: "warning",
    userId: req.user?.id,
    userEmail: req.user?.email,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    method: req.method,
    path: req.path,
    success: false,
    details: {
      activity,
      ...details,
    },
  });
};

export default {
  logSecurityEvent,
  logAuthEvent,
  logAdminAction,
  logFailedLogin,
  logSuspiciousActivity,
};
