import User from '../models/User.js';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Favorite from '../models/Favorite.js';
import AuditLog from '../models/AuditLog.js';
import Session from '../models/Session.js';
import LoginAttempt from '../models/LoginAttempt.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../utils/constants.js';
import { comparePassword } from '../utils/encryption.js';
import { logAuthEvent } from '../services/audit.service.js';

/**
 * Export all user data (GDPR Article 15 - Right to Access)
 * GET /api/gdpr/export-data
 */
export const exportUserData = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch all user data
    const [user, orders, cart, favorites, auditLogs, sessions, loginAttempts] = await Promise.all([
      User.findById(userId).select('+phone'),
      Order.find({ user: userId }),
      Cart.findOne({ user: userId }).populate('items.product', 'name price'),
      Favorite.find({ user: userId }).populate('product', 'name price description'),
      AuditLog.find({ userId }).lean(),
      Session.find({ userId }).lean(),
      LoginAttempt.find({ userId }).lean(),
    ]);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Compile all data into a structured format
    const exportData = {
      exportDate: new Date().toISOString(),
      dataSubject: {
        userId: user._id,
        email: user.email,
      },
      personalInformation: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        accountCreated: user.createdAt,
        lastUpdated: user.updatedAt,
        lastLogin: user.lastLogin,
      },
      securityInformation: {
        twoFactorEnabled: user.twoFactorEnabled,
        totpEnabled: user.totpEnabled,
        passwordChangedAt: user.passwordChangedAt,
        passwordExpiresAt: user.passwordExpiresAt,
        failedLoginAttempts: user.failedLoginAttempts,
        accountLockedUntil: user.accountLockedUntil,
        isActive: user.isActive,
        isSuspended: user.isSuspended,
      },
      orders: orders.map((order) => ({
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items,
        shippingAddress: order.shippingAddress,
        phone: order.phone,
        totalPrice: order.totalPrice,
        paidAt: order.paidAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
      })),
      cart: cart
        ? {
            items: cart.items,
            totalItems: cart.totalItems,
            lastUpdated: cart.updatedAt,
          }
        : null,
      favorites: favorites.map((fav) => ({
        product: fav.product,
        addedAt: fav.createdAt,
      })),
      activityLogs: auditLogs.map((log) => ({
        category: log.category,
        action: log.action,
        timestamp: log.createdAt,
        ip: log.ip,
        userAgent: log.userAgent,
        success: log.success,
        details: log.details,
      })),
      sessions: sessions.map((session) => ({
        deviceInfo: session.deviceInfo,
        ip: session.ip,
        location: session.location,
        lastActivity: session.lastActivity,
        createdAt: session.createdAt,
        isActive: session.isActive,
      })),
      loginAttempts: loginAttempts.map((attempt) => ({
        timestamp: attempt.createdAt,
        ip: attempt.ip,
        userAgent: attempt.userAgent,
        success: attempt.success,
        failureReason: attempt.failureReason,
      })),
      dataRetentionPolicy: {
        activeAccountData: 'Retained while account is active',
        inactiveAccountData: 'Deleted after 2 years of inactivity',
        auditLogs: 'Retained for 1 year',
        orderHistory: 'Retained for 7 years (legal requirement)',
      },
    };

    // Log the export
    await logAuthEvent('data_export', req, user, true);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-export-${userId}.json"`);

    res.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request account deletion (GDPR Article 17 - Right to Erasure)
 * POST /api/gdpr/request-deletion
 */
export const requestAccountDeletion = async (req, res, next) => {
  try {
    const { password, confirmation } = req.body;

    if (confirmation !== 'DELETE MY ACCOUNT') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Please type "DELETE MY ACCOUNT" to confirm deletion',
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid password',
      });
    }

    // Check for pending orders
    const pendingOrders = await Order.countDocuments({
      user: user._id,
      status: { $in: ['pending', 'paid', 'processing', 'shipped'] },
    });

    if (pendingOrders > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `You have ${pendingOrders} pending order(s). Please wait for them to be completed or cancelled before deleting your account.`,
      });
    }

    // Perform account deletion
    await deleteUserAccount(user._id);

    // Log the deletion (before deleting audit logs)
    await logAuthEvent('account_deleted', req, user, true);

    res.json({
      success: true,
      message: 'Your account has been permanently deleted',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to delete user account and all associated data
 * @param {string} userId - User ID
 */
const deleteUserAccount = async (userId) => {
  // Delete in specific order to handle dependencies
  await Promise.all([
    // Delete user's cart
    Cart.deleteMany({ user: userId }),

    // Delete user's favorites
    Favorite.deleteMany({ user: userId }),

    // Delete user's sessions
    Session.deleteMany({ userId }),

    // Delete user's login attempts
    LoginAttempt.deleteMany({ userId }),

    // Delete user's audit logs (keep for legal retention if needed)
    // Uncomment the line below if you want to delete audit logs
    // AuditLog.deleteMany({ userId }),

    // Anonymize completed orders (keep for legal/accounting requirements)
    // Instead of deleting, we anonymize the PII
    Order.updateMany(
      { user: userId, status: { $in: ['delivered', 'cancelled'] } },
      {
        $set: {
          phone: '[DELETED]',
          'shippingAddress.street': '[DELETED]',
          'shippingAddress.city': '[DELETED]',
          'shippingAddress.state': '[DELETED]',
          'shippingAddress.zipCode': '[DELETED]',
          customerNotes: '[DELETED]',
        },
      }
    ),

    // Delete the user account
    User.findByIdAndDelete(userId),
  ]);
};

/**
 * Get account deletion eligibility
 * GET /api/gdpr/deletion-eligibility
 */
export const getDeletionEligibility = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Check for pending orders
    const pendingOrders = await Order.find({
      user: userId,
      status: { $in: ['pending', 'paid', 'processing', 'shipped'] },
    }).select('orderNumber status');

    const eligible = pendingOrders.length === 0;

    res.json({
      success: true,
      data: {
        eligible,
        pendingOrders: pendingOrders.map((order) => ({
          orderNumber: order.orderNumber,
          status: order.status,
        })),
        message: eligible
          ? 'Your account is eligible for deletion'
          : 'You have pending orders that must be completed or cancelled first',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Permanently delete user account (with audit trail)
 * DELETE /api/gdpr/admin/delete-user/:userId
 */
export const adminDeleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Log admin deletion
    await logAuthEvent('admin_account_deletion', req, user, true, reason);

    // Delete account
    await deleteUserAccount(userId);

    res.json({
      success: true,
      message: 'User account deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default {
  exportUserData,
  requestAccountDeletion,
  getDeletionEligibility,
  adminDeleteUser,
};
