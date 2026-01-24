import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from '../config/redis.js';
import { securityConfig } from '../config/security.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

/**
 * Create rate limiter with Redis store if available, otherwise use memory store
 */
const createRateLimiter = (options) => {
  const redisClient = getRedisClient();

  const limiterOptions = {
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
  };

  // Use Redis store if available for distributed rate limiting
  if (redisClient && redisClient.isOpen) {
    limiterOptions.store = new RedisStore({
      // @ts-expect-error - Known issue with the options
      client: redisClient,
      prefix: 'rl:',
    });
    logger.info('Rate limiter using Redis store');
  } else {
    logger.warn('Rate limiter using memory store (not suitable for production)');
  }

  return rateLimit(limiterOptions);
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
    return req.path === '/health' || req.path === '/api/health';
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
  message: 'Too many API requests from this IP, please try again later.',
});
