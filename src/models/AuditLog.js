import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    // Event classification
    category: {
      type: String,
      enum: ['auth', 'user', 'admin', 'security', 'payment', 'product', 'order', 'profile', 'cart', 'favorite'],
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'error', 'critical'],
      default: 'info',
      index: true,
    },

    // User information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    userEmail: {
      type: String,
      index: true,
    },

    // Request information
    ip: {
      type: String,
      required: true,
      index: true,
    },
    userAgent: {
      type: String,
    },
    method: {
      type: String,
    },
    path: {
      type: String,
    },

    // Event details
    success: {
      type: Boolean,
      default: true,
      index: true,
    },
    errorMessage: {
      type: String,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Target information (for admin actions, updates, etc.)
    targetType: {
      type: String,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Session tracking
    sessionId: {
      type: String,
      index: true,
    },

    // Geolocation (optional, can be added with IP geolocation service)
    location: {
      country: String,
      city: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ ip: 1, createdAt: -1 });

// TTL index to automatically delete old logs after 1 year (optional)
// auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Static method to create audit log entry
auditLogSchema.statics.createLog = async function (logData) {
  try {
    return await this.create(logData);
  } catch (error) {
    // Don't throw error to prevent audit logging from breaking the application
    console.error('Failed to create audit log:', error);
    return null;
  }
};

// Static method to get user activity logs
auditLogSchema.statics.getUserActivity = async function (userId, options = {}) {
  const { page = 1, limit = 20, category, action, startDate, endDate } = options;

  const query = { userId };

  if (category) {
    query.category = category;
  }

  if (action) {
    query.action = action;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Static method to get security events
auditLogSchema.statics.getSecurityEvents = async function (options = {}) {
  const { page = 1, limit = 50, severity, startDate, endDate } = options;

  const query = {
    $or: [
      { category: 'security' },
      { category: 'auth', success: false },
      { severity: { $in: ['warning', 'error', 'critical'] } },
    ],
  };

  if (severity) {
    query.severity = severity;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'email firstName lastName')
      .lean(),
    this.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Static method to get failed login attempts
auditLogSchema.statics.getFailedLogins = async function (options = {}) {
  const { ip, email, hours = 24 } = options;

  const query = {
    category: 'auth',
    action: { $in: ['login', 'failed_login'] },
    success: false,
    createdAt: { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
  };

  if (ip) {
    query.ip = ip;
  }

  if (email) {
    query.userEmail = email;
  }

  return await this.find(query).sort({ createdAt: -1 }).lean();
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
