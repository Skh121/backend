import mongoose from 'mongoose';
import { USER_ROLES } from '../utils/constants.js';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false, // Don't return password by default
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: 50,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
    },

    // Email verification
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },

    // Password reset
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },

    // 2FA
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorCode: {
      type: String,
      select: false,
    },
    twoFactorCodeExpires: {
      type: Date,
      select: false,
    },
    twoFactorVerified: {
      type: Boolean,
      default: false,
    },

    // Account security
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    accountLockedUntil: {
      type: Date,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },

    // Refresh token
    refreshTokenHash: {
      type: String,
      select: false,
    },
    refreshTokenExpires: {
      type: Date,
      select: false,
    },

    // Account status
    isActive: {
      type: Boolean,
      default: true,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    suspensionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.emailVerificationToken;
        delete ret.passwordResetToken;
        delete ret.twoFactorCode;
        delete ret.refreshTokenHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index for faster queries (email index auto-created by unique: true)
userSchema.index({ role: 1 });
userSchema.index({ isEmailVerified: 1 });

// Method to check if account is locked
userSchema.methods.isAccountLocked = function () {
  return this.accountLockedUntil && this.accountLockedUntil > Date.now();
};

// Method to increment failed login attempts
userSchema.methods.incrementLoginAttempts = async function () {
  // Reset attempts if lock has expired
  if (this.accountLockedUntil && this.accountLockedUntil < Date.now()) {
    this.failedLoginAttempts = 1;
    this.accountLockedUntil = null;
  } else {
    this.failedLoginAttempts += 1;

    // Lock account after 5 failed attempts
    if (this.failedLoginAttempts >= 5) {
      this.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
  }

  await this.save();
};

// Method to reset failed login attempts
userSchema.methods.resetLoginAttempts = async function () {
  this.failedLoginAttempts = 0;
  this.accountLockedUntil = null;
  await this.save();
};

const User = mongoose.model('User', userSchema);

export default User;
