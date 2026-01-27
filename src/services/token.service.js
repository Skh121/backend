import jwt from "jsonwebtoken";
import { securityConfig } from "../config/security.js";
import { logger } from "../utils/logger.js";

/**
 * Generate access token
 * @param {object} payload - Token payload (user id, role, etc.)
 * @returns {string} JWT access token
 */
export const generateAccessToken = (payload) => {
  try {
    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: securityConfig.jwt.accessTokenExpiry,
      issuer: securityConfig.jwt.issuer,
      audience: securityConfig.jwt.audience,
    });
  } catch (error) {
    logger.error("Error generating access token:", error);
    throw new Error("Error generating access token");
  }
};

/**
 * Generate refresh token
 * @param {object} payload - Token payload (user id)
 * @returns {string} JWT refresh token
 */
export const generateRefreshToken = (payload) => {
  try {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: securityConfig.jwt.refreshTokenExpiry,
      issuer: securityConfig.jwt.issuer,
      audience: securityConfig.jwt.audience,
    });
  } catch (error) {
    logger.error("Error generating refresh token:", error);
    throw new Error("Error generating refresh token");
  }
};

/**
 * Verify access token
 * @param {string} token - JWT access token
 * @returns {object} Decoded token payload
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      issuer: securityConfig.jwt.issuer,
      audience: securityConfig.jwt.audience,
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Access token expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid access token");
    }
    logger.error("Error verifying access token:", error);
    throw new Error("Error verifying access token");
  }
};

/**
 * Verify refresh token
 * @param {string} token - JWT refresh token
 * @returns {object} Decoded token payload
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
      issuer: securityConfig.jwt.issuer,
      audience: securityConfig.jwt.audience,
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Refresh token expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid refresh token");
    }
    logger.error("Error verifying refresh token:", error);
    throw new Error("Error verifying refresh token");
  }
};

/**
 * Generate both access and refresh tokens
 * @param {object} user - User object
 * @returns {object} Object containing access and refresh tokens
 */
export const generateTokenPair = (user) => {
  const payload = {
    id: user._id || user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ id: payload.id });

  return { accessToken, refreshToken };
};
