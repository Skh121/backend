import rateLimit from "express-rate-limit";
import { securityConfig } from "../config/security.js";
import { HTTP_STATUS, ERROR_MESSAGES } from "../utils/constants.js";
import { logger } from "../utils/logger.js";

// In-memory set for temporarily blocked IPs (in production, use Redis or similar)
const blockedIPs = new Set();

/**
 * Middleware to check if an IP is in the blocklist
 */
export const checkIPBlocked = (req, res, next) => {
  if (blockedIPs.has(req.ip)) {
    logger.warn(`Blocked IP attempt: ${req.ip} tried to access ${req.path}`);
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: ERROR_MESSAGES.IP_BLOCKED,
      type: "IP_BLOCK",
    });
  }
  next();
};

/**
 * Utility to temporarily block an IP
 * @param {string} ip - IP address to block
 */
export const blockIP = (ip) => {
  blockedIPs.add(ip);
  logger.info(`IP ${ip} has been added to the blocklist`);
};

/**
 * Create rate limiter with memory store
 * @param {Object} options - Rate limit options
 * @param {boolean} isAuth - Whether this is for authentication
 */
const createRateLimiter = (options, isAuth = false) => {
  return rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const isBlocked = req.ipBlocked; // This would be set by a previous middleware if we had IP blocking logic

      logger.warn(`${isBlocked ? "IP Blocked" : "Rate limit exceeded"} for IP: ${req.ip}, Path: ${req.path}`);

      const statusCode = isBlocked ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.TOO_MANY_REQUESTS;
      const message = isBlocked
        ? "Your IP has been flagged and blocked. Please contact support if you believe this is an error."
        : (options.message || "Too many attempts, please try again later.");

      res.status(statusCode).json({
        success: false,
        message,
        type: isBlocked ? "IP_BLOCK" : "RATE_LIMIT",
        retryAfter: Math.ceil(options.windowMs / 1000 / 60) + " minutes"
      });
    },
  });
};

/**
 * Global rate limiter - applies to all requests
 */
export const globalRateLimiter = createRateLimiter({
  windowMs: securityConfig.rateLimit.global.windowMs,
  max: securityConfig.rateLimit.global.max,
  message: securityConfig.rateLimit.global.message,
  skip: (req) => {
    // Skip rate limiting for health check endpoints
    if (req.path === "/health" || req.path === "/api/health") return true;

    // Skip for localhost in development to prevent blocks during rapid reloads/testing
    if (
      process.env.NODE_ENV === "development" &&
      (req.ip === "::1" || req.ip === "127.0.0.1")
    ) {
      return true;
    }

    // Always allow session maintenance routes to bypass global limit
    // (they have their own specific limits in security.js)
    const bypassRoutes = [
      "/api/auth/refresh",
      "/api/auth/logout",
      "/api/csrf-token",
    ];
    if (bypassRoutes.some((route) => req.path.includes(route))) {
      return true;
    }

    // Skip global rate limiting for auth routes (they have their own strict limits)
    if (req.path.startsWith("/api/auth")) {
      return true;
    }

    return false;
  },
});

/**
 * Strict rate limiter for authentication endpoints
 */
export const authRateLimiter = createRateLimiter({
  windowMs: securityConfig.rateLimit.auth.windowMs,
  max: securityConfig.rateLimit.auth.max,
  message: securityConfig.rateLimit.auth.message,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * API rate limiter for general API endpoints
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: securityConfig.rateLimit.api.windowMs,
  max: securityConfig.rateLimit.api.max,
  message: "Too many API requests from this IP, please try again later.",
});
