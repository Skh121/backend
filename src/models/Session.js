import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
    },

    // Device information
    deviceInfo: {
      userAgent: {
        type: String,
        required: true,
      },
      browser: {
        type: String,
      },
      os: {
        type: String,
      },
      device: {
        type: String,
      },
    },

    // Location information
    ip: {
      type: String,
      required: true,
    },
    location: {
      country: String,
      city: String,
      region: String,
    },

    // Session status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // Security flags
    isTrusted: {
      type: Boolean,
      default: false,
    },
    flaggedAsSuspicious: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
sessionSchema.index({ userId: 1, isActive: 1 });
// Automatic cleanup of expired sessions (TTL index)
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to update last activity
sessionSchema.methods.updateActivity = async function () {
  this.lastActivity = new Date();
  await this.save();
};

// Method to revoke session
sessionSchema.methods.revoke = async function () {
  this.isActive = false;
  await this.save();
};

// Static method to get active sessions for a user
sessionSchema.statics.getActiveSessions = async function (userId) {
  return await this.find({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  }).sort({ lastActivity: -1 });
};

// Static method to revoke all sessions for a user
sessionSchema.statics.revokeAllSessions = async function (userId, exceptSessionToken = null) {
  const query = {
    userId,
    isActive: true,
  };

  if (exceptSessionToken) {
    query.sessionToken = { $ne: exceptSessionToken };
  }

  await this.updateMany(query, { isActive: false });
};

// Static method to cleanup inactive sessions
sessionSchema.statics.cleanupInactiveSessions = async function (inactiveDays = 30) {
  const cutoffDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

  await this.deleteMany({
    $or: [
      { isActive: false },
      { lastActivity: { $lt: cutoffDate } },
      { expiresAt: { $lt: new Date() } },
    ],
  });
};

const Session = mongoose.model('Session', sessionSchema);

export default Session;
