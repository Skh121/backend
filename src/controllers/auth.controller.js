import User from "../models/User.js";
import LoginAttempt from "../models/LoginAttempt.js";
import {
  hashPassword,
  comparePassword,
  generateRandomToken,
  generateOTP,
} from "../utils/encryption.js";
import {
  generateTokenPair,
  verifyRefreshToken,
} from "../services/token.service.js";
import {
  sendVerificationEmail,
  send2FACode,
  sendPasswordResetEmail,
} from "../services/email.service.js";
import { logAuthEvent, logFailedLogin } from "../services/audit.service.js";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../utils/constants.js";
import { securityConfig } from "../config/security.js";

/**
 * Register new user
 * POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: ERROR_MESSAGES.USER_ALREADY_EXISTS,
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate 6-digit verification PIN
    const verificationPIN = generateOTP();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      emailVerificationToken: verificationPIN,
      emailVerificationExpires: verificationExpires,
      passwordChangedAt: new Date(),
      passwordExpiresAt: new Date(
        Date.now() + securityConfig.password.expiryDays * 24 * 60 * 60 * 1000,
      ),
    });

    // Send verification PIN via email
    await sendVerificationEmail(email, verificationPIN);

    // Log event
    logAuthEvent("register", req, user, true);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message:
        "Registration successful. Please check your email for a 6-digit verification PIN.",
      data: {
        userId: user._id,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify email with PIN
 * POST /api/auth/verify-email
 */
export const verifyEmail = async (req, res, next) => {
  try {
    const { email, pin } = req.body;

    if (!email || !pin) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Email and PIN are required",
      });
    }

    const user = await User.findOne({
      email,
      emailVerificationToken: pin,
      emailVerificationExpires: { $gt: Date.now() },
    }).select("+emailVerificationToken +emailVerificationExpires +password");

    if (!user) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Invalid or expired PIN",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    logAuthEvent("email_verified", req, user, true);

    // Generate tokens and log the user in automatically
    const tokens = await generateTokenPair(user);

    // Set tokens in HTTP-only cookies
    res.cookie("accessToken", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      message: "Email verified successfully! You are now logged in.",
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          profileImage: user.profileImage,
          createdAt: user.createdAt,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user with password field
    const user = await User.findOne({ email }).select(
      "+password +refreshTokenHash",
    );

    // Check if user exists
    if (!user) {
      await LoginAttempt.create({
        email,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        success: false,
        failureReason: "invalid_credentials",
      });

      logFailedLogin(email, req, "invalid_credentials");

      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_CREDENTIALS,
      });
    }

    // Check if account is suspended
    if (user.isSuspended) {
      await LoginAttempt.create({
        email,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        success: false,
        failureReason: "account_suspended",
        userId: user._id,
      });

      logFailedLogin(email, req, "account_suspended");

      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: "Your account has been suspended",
      });
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      await LoginAttempt.create({
        email,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        success: false,
        failureReason: "account_locked",
        userId: user._id,
      });

      logFailedLogin(email, req, "account_locked");

      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.ACCOUNT_LOCKED,
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      await LoginAttempt.create({
        email,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        success: false,
        failureReason: "email_not_verified",
        userId: user._id,
      });

      logFailedLogin(email, req, "email_not_verified");

      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.EMAIL_NOT_VERIFIED,
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      await user.incrementLoginAttempts();

      await LoginAttempt.create({
        email,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        success: false,
        failureReason: "invalid_credentials",
        userId: user._id,
      });

      logFailedLogin(email, req, "invalid_password");

      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_CREDENTIALS,
      });
    }

    // Reset failed login attempts
    await user.resetLoginAttempts();

    // Check if TOTP (authenticator app) is enabled
    if (user.totpEnabled) {
      return res.json({
        success: true,
        message: "Please enter your authenticator code",
        requiresTOTP: true,
        email: user.email,
      });
    }

    // Email-based 2FA has been disabled - using TOTP only
    // if (user.twoFactorEnabled) {
    //   // Generate and send 2FA code
    //   const twoFactorCode = generateOTP(securityConfig.twoFactor.codeLength);
    //   user.twoFactorCode = twoFactorCode;
    //   user.twoFactorCodeExpires = new Date(Date.now() + securityConfig.twoFactor.codeExpiry);
    //   user.twoFactorVerified = false;
    //   await user.save();

    //   await send2FACode(email, twoFactorCode);

    //   return res.json({
    //     success: true,
    //     message: '2FA code sent to your email',
    //     requires2FA: true,
    //   });
    // }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Store refresh token hash
    user.refreshTokenHash = await hashPassword(refreshToken);
    user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.lastLogin = new Date();
    await user.save();

    // Log successful login
    await LoginAttempt.create({
      email,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      success: true,
      userId: user._id,
    });

    logAuthEvent("login", req, user, true);

    // Set cookies
    res.cookie("accessToken", accessToken, {
      ...securityConfig.cookie,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, securityConfig.cookie);

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          profileImage: user.profileImage,
          createdAt: user.createdAt,
          role: user.role,
        },
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify 2FA code
 * POST /api/auth/verify-2fa
 */
export const verify2FA = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email }).select(
      "+twoFactorCode +twoFactorCodeExpires +refreshTokenHash",
    );

    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_CREDENTIALS,
      });
    }

    // Check if 2FA code is valid
    if (
      !user.twoFactorCode ||
      user.twoFactorCode !== code ||
      user.twoFactorCodeExpires < Date.now()
    ) {
      await LoginAttempt.create({
        email,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        success: false,
        failureReason: "invalid_2fa_code",
        userId: user._id,
      });

      logFailedLogin(email, req, "invalid_2fa_code");

      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Invalid or expired 2FA code",
      });
    }

    // Clear 2FA code
    user.twoFactorCode = undefined;
    user.twoFactorCodeExpires = undefined;
    user.twoFactorVerified = true;

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Store refresh token hash
    user.refreshTokenHash = await hashPassword(refreshToken);
    user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.lastLogin = new Date();
    await user.save();

    // Log successful login
    await LoginAttempt.create({
      email,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      success: true,
      userId: user._id,
    });

    logAuthEvent("login_2fa", req, user, true);

    // Set cookies
    res.cookie("accessToken", accessToken, {
      ...securityConfig.cookie,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, securityConfig.cookie);

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          profileImage: user.profileImage,
          createdAt: user.createdAt,
          role: user.role,
        },
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
export const refreshAccessToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.UNAUTHORIZED,
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user and validate refresh token
    const user = await User.findById(decoded.id).select(
      "+refreshTokenHash +refreshTokenExpires",
    );

    if (
      !user ||
      !user.refreshTokenHash ||
      user.refreshTokenExpires < Date.now()
    ) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_TOKEN,
      });
    }

    // Verify refresh token hash
    const isTokenValid = await comparePassword(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!isTokenValid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_TOKEN,
      });
    }

    // Generate new token pair (refresh token rotation)
    const { accessToken, refreshToken: newRefreshToken } =
      generateTokenPair(user);

    // Update refresh token hash
    user.refreshTokenHash = await hashPassword(newRefreshToken);
    user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    // Set new cookies
    res.cookie("accessToken", accessToken, {
      ...securityConfig.cookie,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", newRefreshToken, securityConfig.cookie);

    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    // Clear refresh token from database
    if (req.user) {
      await User.findByIdAndUpdate(req.user.id, {
        $unset: { refreshTokenHash: 1, refreshTokenExpires: 1 },
      });

      logAuthEvent("logout", req, req.user, true);
    }

    // Clear cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.LOGOUT_SUCCESS,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: SUCCESS_MESSAGES.PASSWORD_RESET_EMAIL_SENT,
      });
    }

    // Generate reset token
    const resetToken = generateRandomToken(32);
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(
      Date.now() + securityConfig.passwordReset.tokenExpiry,
    );
    await user.save();

    // Send reset email
    await sendPasswordResetEmail(email, resetToken);

    logAuthEvent("password_reset_requested", req, user, true);

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.PASSWORD_RESET_EMAIL_SENT,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password
 * POST /api/auth/reset-password
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    }).select(
      "+passwordResetToken +passwordResetExpires +password +passwordHistory",
    );

    if (!user) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Check if password is in history
    const isPasswordReused = await user.isPasswordInHistory(password);
    if (isPasswordReused) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Cannot reuse your last ${securityConfig.password.historyLimit} passwords`,
      });
    }

    // Add current password to history before changing
    if (user.password) {
      await user.addToPasswordHistory(user.password);
    }

    // Hash new password
    user.password = await hashPassword(password);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Update password change timestamp and expiry
    user.passwordChangedAt = new Date();
    user.passwordExpiresAt = new Date(
      Date.now() + securityConfig.password.expiryDays * 24 * 60 * 60 * 1000,
    );

    // Invalidate all refresh tokens
    user.refreshTokenHash = undefined;
    user.refreshTokenExpires = undefined;

    await user.save();

    logAuthEvent("password_reset", req, user, true);

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.PASSWORD_RESET_SUCCESS,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 * GET /api/auth/me
 */
export const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  register,
  verifyEmail,
  login,
  verify2FA,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  getCurrentUser,
};
