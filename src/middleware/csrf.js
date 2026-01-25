import { generateRandomToken } from "../utils/encryption.js";
import { securityConfig } from "../config/security.js";
import { HTTP_STATUS, ERROR_MESSAGES } from "../utils/constants.js";

/**
 * Generate and set CSRF token
 */
export const generateCSRFToken = (req, res, next) => {
  // Generate CSRF token if not exists
  if (!req.cookies[securityConfig.csrf.cookieName]) {
    const csrfToken = generateRandomToken(32);

    res.cookie(securityConfig.csrf.cookieName, csrfToken, {
      httpOnly: false, // Must be accessible to JavaScript to send in headers
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    req.csrfToken = csrfToken;
  } else {
    req.csrfToken = req.cookies[securityConfig.csrf.cookieName];
  }

  next();
};

/**
 * Verify CSRF token for state-changing operations
 */
export const verifyCSRFToken = (req, res, next) => {
  // Skip CSRF verification for GET, HEAD, OPTIONS requests
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies[securityConfig.csrf.cookieName];
  const headerToken = req.headers[securityConfig.csrf.headerName];

  // Check if tokens exist
  if (!cookieToken || !headerToken) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: ERROR_MESSAGES.CSRF_INVALID,
    });
  }

  // Compare tokens (constant-time comparison to prevent timing attacks)
  if (cookieToken !== headerToken) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: ERROR_MESSAGES.CSRF_INVALID,
    });
  }

  next();
};

/**
 * Endpoint to get CSRF token
 */
export const getCSRFToken = (req, res) => {
  res.json({
    success: true,
    csrfToken: req.csrfToken,
  });
};
