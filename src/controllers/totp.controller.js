import User from "../models/User.js";
import {
  generateTOTPSecret,
  generateQRCode,
  verifyTOTPToken,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
} from "../services/totp.service.js";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../utils/constants.js";
import { logAuthEvent } from "../services/audit.service.js";

/**
 * Step 1: Generate TOTP secret and QR code
 * POST /api/totp/setup
 */
export const setupTOTP = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Generate TOTP secret
    const { secret, otpauthUrl } = generateTOTPSecret(user.email);

    // Generate QR code
    const qrCodeDataUrl = await generateQRCode(otpauthUrl);

    // Save secret temporarily (not verified yet)
    user.totpSecret = secret;
    user.totpVerified = false;
    await user.save();

    res.json({
      success: true,
      message:
        "TOTP secret generated. Scan the QR code with your authenticator app.",
      data: {
        secret,
        qrCode: qrCodeDataUrl,
        manualEntry: secret, // For manual entry if QR scan fails
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Step 2: Verify TOTP token and enable TOTP
 * POST /api/totp/verify
 */
export const verifyAndEnableTOTP = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "TOTP token is required",
      });
    }

    const user = await User.findById(req.user.id).select(
      "+totpSecret +backupCodes",
    );

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    if (!user.totpSecret) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Please setup TOTP first",
      });
    }

    // Verify TOTP token
    const isValid = verifyTOTPToken(token, user.totpSecret);

    if (!isValid) {
      await logAuthEvent(
        "totp_verification_failed",
        req,
        user,
        false,
        "invalid_token",
      );

      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Invalid TOTP token",
      });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes(10);
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => hashBackupCode(code)),
    );

    // Enable TOTP
    user.totpEnabled = true;
    user.totpVerified = true;
    user.backupCodes = hashedBackupCodes;
    await user.save();

    await logAuthEvent("totp_enabled", req, user, true);

    res.json({
      success: true,
      message: "TOTP enabled successfully",
      data: {
        backupCodes, // Send unhashed codes only once
        message:
          "Save these backup codes in a safe place. They can be used if you lose access to your authenticator app.",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disable TOTP
 * POST /api/totp/disable
 */
export const disableTOTP = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Password is required to disable TOTP",
      });
    }

    const user = await User.findById(req.user.id).select(
      "+password +totpSecret +backupCodes",
    );

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Verify password
    const bcrypt = (await import("bcrypt")).default;
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Invalid password",
      });
    }

    // Disable TOTP
    user.totpEnabled = false;
    user.totpSecret = undefined;
    user.totpVerified = false;
    user.backupCodes = [];
    await user.save();

    await logAuthEvent("totp_disabled", req, user, true);

    res.json({
      success: true,
      message: "TOTP disabled successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Regenerate backup codes
 * POST /api/totp/regenerate-backup-codes
 */
export const regenerateBackupCodes = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Password is required",
      });
    }

    const user = await User.findById(req.user.id).select(
      "+password +backupCodes",
    );

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    if (!user.totpEnabled) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "TOTP is not enabled",
      });
    }

    // Verify password
    const bcrypt = (await import("bcrypt")).default;
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Invalid password",
      });
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes(10);
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => hashBackupCode(code)),
    );

    user.backupCodes = hashedBackupCodes;
    await user.save();

    await logAuthEvent("backup_codes_regenerated", req, user, true);

    res.json({
      success: true,
      message: "Backup codes regenerated successfully",
      data: {
        backupCodes,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get TOTP status
 * GET /api/totp/status
 */
export const getTOTPStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("+backupCodes");

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    res.json({
      success: true,
      data: {
        totpEnabled: user.totpEnabled,
        totpVerified: user.totpVerified,
        backupCodesCount: user.backupCodes?.length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify TOTP during login
 * POST /api/totp/verify-login
 */
export const verifyTOTPLogin = async (req, res, next) => {
  try {
    const { email, token, useBackupCode } = req.body;

    if (!email || !token) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Email and token are required",
      });
    }

    const user = await User.findOne({ email }).select(
      "+totpSecret +backupCodes +refreshTokenHash",
    );

    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: ERROR_MESSAGES.INVALID_CREDENTIALS,
      });
    }

    if (!user.totpEnabled) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "TOTP is not enabled for this account",
      });
    }

    let isValid = false;
    let usedBackupCode = false;

    if (useBackupCode) {
      // Verify backup code
      const result = await verifyBackupCode(token, user.backupCodes);
      isValid = result.isValid;

      if (isValid) {
        // Remove used backup code
        user.backupCodes.splice(result.codeIndex, 1);
        usedBackupCode = true;
      }
    } else {
      // Verify TOTP token
      isValid = verifyTOTPToken(token, user.totpSecret);
    }

    if (!isValid) {
      await logAuthEvent(
        "totp_login_failed",
        req,
        user,
        false,
        "invalid_token",
      );

      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: useBackupCode ? "Invalid backup code" : "Invalid TOTP token",
      });
    }

    // Generate tokens
    const { hashPassword } = await import("../utils/encryption.js");
    const { generateTokenPair } = await import("../services/token.service.js");
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Store refresh token hash
    user.refreshTokenHash = await hashPassword(refreshToken);
    user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.lastLogin = new Date();
    await user.save();

    await logAuthEvent("totp_login", req, user, true);

    // Set cookies
    const { securityConfig } = await import("../config/security.js");
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
        usedBackupCode,
        remainingBackupCodes: user.backupCodes.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  setupTOTP,
  verifyAndEnableTOTP,
  disableTOTP,
  regenerateBackupCodes,
  getTOTPStatus,
  verifyTOTPLogin,
};
