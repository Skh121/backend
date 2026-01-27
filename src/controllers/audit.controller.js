import AuditLog from '../models/AuditLog.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../utils/constants.js';

/**
 * Get user's activity logs
 * GET /api/audit/my-activity
 */
export const getMyActivity = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category;
    const action = req.query.action;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const result = await AuditLog.getUserActivity(req.user.id, {
      page,
      limit,
      category,
      action,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's login history
 * GET /api/audit/login-history
 */
export const getLoginHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await AuditLog.getUserActivity(req.user.id, {
      page,
      limit,
      category: 'auth',
      action: { $in: ['login', 'login_2fa', 'logout'] },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's security events
 * GET /api/audit/security-events
 */
export const getMySecurityEvents = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const query = {
      userId: req.user.id,
      $or: [
        { category: 'security' },
        { success: false },
        { severity: { $in: ['warning', 'error', 'critical'] } },
      ],
    };

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        logs,
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

/**
 * Get activity statistics for current user
 * GET /api/audit/stats
 */
export const getMyStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalActivities, recentActivities, failedLogins, categories] = await Promise.all([
      AuditLog.countDocuments({ userId }),
      AuditLog.countDocuments({ userId, createdAt: { $gte: thirtyDaysAgo } }),
      AuditLog.countDocuments({
        userId,
        category: 'auth',
        success: false,
        createdAt: { $gte: thirtyDaysAgo },
      }),
      AuditLog.aggregate([
        { $match: { userId: userId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalActivities,
        recentActivities,
        failedLogins,
        categories: categories.reduce((acc, cat) => {
          acc[cat._id] = cat.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all audit logs
 * GET /api/audit/admin/logs
 */
export const getAllLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const category = req.query.category;
    const severity = req.query.severity;
    const userId = req.query.userId;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const query = {};

    if (category) query.category = category;
    if (severity) query.severity = severity;
    if (userId) query.userId = userId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'email firstName lastName role')
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        logs,
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

/**
 * Admin: Get security events
 * GET /api/audit/admin/security-events
 */
export const getSecurityEvents = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const severity = req.query.severity;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const result = await AuditLog.getSecurityEvents({
      page,
      limit,
      severity,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get failed login attempts
 * GET /api/audit/admin/failed-logins
 */
export const getFailedLogins = async (req, res, next) => {
  try {
    const ip = req.query.ip;
    const email = req.query.email;
    const hours = parseInt(req.query.hours) || 24;

    const logs = await AuditLog.getFailedLogins({ ip, email, hours });

    res.json({
      success: true,
      data: { logs, count: logs.length },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get audit statistics
 * GET /api/audit/admin/stats
 */
export const getAuditStats = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalLogs,
      recentLogs,
      failedLogins,
      securityEvents,
      adminActions,
      categoriesBreakdown,
      severityBreakdown,
    ] = await Promise.all([
      AuditLog.countDocuments({}),
      AuditLog.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      AuditLog.countDocuments({
        category: 'auth',
        success: false,
        createdAt: { $gte: thirtyDaysAgo },
      }),
      AuditLog.countDocuments({
        category: 'security',
        createdAt: { $gte: thirtyDaysAgo },
      }),
      AuditLog.countDocuments({
        category: 'admin',
        createdAt: { $gte: thirtyDaysAgo },
      }),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalLogs,
        recentLogs,
        failedLogins,
        securityEvents,
        adminActions,
        categories: categoriesBreakdown.reduce((acc, cat) => {
          acc[cat._id] = cat.count;
          return acc;
        }, {}),
        severity: severityBreakdown.reduce((acc, sev) => {
          acc[sev._id] = sev.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get user's audit logs
 * GET /api/audit/admin/user/:userId
 */
export const getUserLogs = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category;
    const action = req.query.action;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const result = await AuditLog.getUserActivity(userId, {
      page,
      limit,
      category,
      action,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getMyActivity,
  getLoginHistory,
  getMySecurityEvents,
  getMyStats,
  getAllLogs,
  getSecurityEvents,
  getFailedLogins,
  getAuditStats,
  getUserLogs,
};
