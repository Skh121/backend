import express from "express";
import {
  register,
  verifyEmail,
  login,
  verify2FA,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  getCurrentUser,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";
import { verifyCaptchaMiddleware } from "../services/captcha.service.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  verify2FASchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../utils/validation.schemas.js";

const router = express.Router();

// Public routes with strict rate limiting and CAPTCHA
router.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  verifyCaptchaMiddleware,
  asyncHandler(register),
);

router.post(
  "/verify-email",
  authRateLimiter,
  validate(verifyEmailSchema),
  asyncHandler(verifyEmail),
);

router.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  verifyCaptchaMiddleware,
  asyncHandler(login),
);

router.post(
  "/verify-2fa",
  authRateLimiter,
  validate(verify2FASchema),
  asyncHandler(verify2FA),
);

router.post(
  "/refresh",
  authRateLimiter,
  validate(refreshTokenSchema),
  asyncHandler(refreshAccessToken),
);

router.post(
  "/forgot-password",
  authRateLimiter,
  validate(forgotPasswordSchema),
  verifyCaptchaMiddleware,
  asyncHandler(forgotPassword),
);

router.post(
  "/reset-password",
  authRateLimiter,
  validate(resetPasswordSchema),
  asyncHandler(resetPassword),
);

// Protected routes
router.post("/logout", authenticate, asyncHandler(logout));

router.get("/me", authenticate, asyncHandler(getCurrentUser));

export default router;
