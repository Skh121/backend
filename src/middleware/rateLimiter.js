import rateLimit from "express-rate-limit";
import { securityConfig } from "../config/security.js";
import { HTTP_STATUS } from "../utils/constants.js";
import { logger } from "../utils/logger.js";

/**
 * Create rate limiter with memory store
 */
const createRateLimiter = (options) => {
  return rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        message: options.message || securityConfig.rateLimit.global.message,
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
