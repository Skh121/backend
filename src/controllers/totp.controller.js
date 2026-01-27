import User from "../models/User.js";
import Order from "../models/Order.js";
import { hashPassword, comparePassword } from "../utils/encryption.js";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../utils/constants.js";
import { securityConfig } from "../config/security.js";

/**
 * Get user profile
 * GET /api/users/profile
 */
export const getProfile = async (req, res, next) => {
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

/**
 * Update user profile
 * PUT /api/users/profile
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;

    await user.save();

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.PROFILE_UPDATED,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload profile image
 * POST /api/users/profile/image
 */
export const uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "No image file provided",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Store the image path (Cloudinary URL)
    user.profileImage = req.file.path;
    await user.save();

    res.json({
      success: true,
      message: "Profile image uploaded successfully",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete profile image
 * DELETE /api/users/profile/image
 */
export const deleteProfileImage = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Clear the profile image
    user.profileImage = null;
    await user.save();

    res.json({
      success: true,
      message: "Profile image removed successfully",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password
 * POST /api/users/change-password
 */
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select(
      "+password +passwordHistory",
    );

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Verify current password
    const isPasswordValid = await comparePassword(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Check if new password is in history
    const isPasswordReused = await user.isPasswordInHistory(newPassword);
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

    // Hash and update new password
    user.password = await hashPassword(newPassword);

    // Update password change timestamp and expiry
    user.passwordChangedAt = new Date();
    user.passwordExpiresAt = new Date(
      Date.now() + securityConfig.password.expiryDays * 24 * 60 * 60 * 1000,
    );

    // Invalidate all refresh tokens
    user.refreshTokenHash = undefined;
    user.refreshTokenExpires = undefined;

    await user.save();

    const daysUntilExpiry = user.getDaysUntilPasswordExpiry();

    res.json({
      success: true,
      message: "Password changed successfully",
      data: {
        passwordExpiresIn: daysUntilExpiry,
        passwordExpiryDate: user.passwordExpiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Enable 2FA - DISABLED (Using TOTP-based MFA instead)
 * POST /api/users/enable-2fa
 */
// export const enable2FA = async (req, res, next) => {
//   try {
//     const user = await User.findById(req.user.id);

//     if (!user) {
//       return res.status(HTTP_STATUS.NOT_FOUND).json({
//         success: false,
//         message: ERROR_MESSAGES.USER_NOT_FOUND,
//       });
//     }

//     user.twoFactorEnabled = true;
//     await user.save();

//     res.json({
//       success: true,
//       message: '2FA enabled successfully',
//     });
//   } catch (error) {
//     next(error);
//   }
// };

/**
 * Disable 2FA - DISABLED (Using TOTP-based MFA instead)
 * POST /api/users/disable-2fa
 */
// export const disable2FA = async (req, res, next) => {
//   try {
//     const user = await User.findById(req.user.id);

//     if (!user) {
//       return res.status(HTTP_STATUS.NOT_FOUND).json({
//         success: false,
//         message: ERROR_MESSAGES.USER_NOT_FOUND,
//       });
//     }

//     user.twoFactorEnabled = false;
//     user.twoFactorCode = undefined;
//     user.twoFactorCodeExpires = undefined;
//     await user.save();

//     res.json({
//       success: true,
//       message: '2FA disabled successfully',
//     });
//   } catch (error) {
//     next(error);
//   }
// };

/**
 * Get user's order history
 * GET /api/users/orders
 */
export const getUserOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { user: req.user.id };

    if (req.query.status) {
      query.status = req.query.status;
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("items.product", "name images"),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getProfile,
  updateProfile,
  changePassword,
  getUserOrders,
};
