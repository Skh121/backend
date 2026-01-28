import mongoose from "mongoose";
import { USER_ROLES } from "../utils/constants.js";
import {
  encryptField,
  decryptField,
  isEncrypted,
} from "../utils/encryption.js";
import { securityConfig } from "../config/security.js";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password: {
      type: String,
      required: function () {
        return this.authProvider === "local";
      },
      minlength: 8,
      select: false, // Don't return password by default
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: 50,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    profileImage: {
      type: String,
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

    // 2FA - Email-based
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

    // 2FA - TOTP (Authenticator App)
    totpEnabled: {
      type: Boolean,
      default: false,
    },
    totpSecret: {
      type: String,
      select: false,
    },
    totpVerified: {
      type: Boolean,
      default: false,
    },
    backupCodes: {
      type: [String],
      default: [],
      select: false,
    },

    // OAuth providers
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows null values while maintaining uniqueness
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
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

    passwordChangedAt: {
      type: Date,
      default: null,
    },
    passwordExpiresAt: {
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
  },
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

    // Lock account after max failed attempts
    if (this.failedLoginAttempts >= securityConfig.lockout.maxFailedAttempts) {
      this.accountLockedUntil = new Date(Date.now() + securityConfig.lockout.lockDuration);
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

// Method to check if password is the same as current password
userSchema.methods.isPasswordInHistory = async function (newPassword) {
  if (!this.password) {
    return false;
  }

  // Import bcrypt dynamically to avoid circular dependency
  const bcrypt = (await import("bcrypt")).default;

  // Check if new password matches current hashed password
  return await bcrypt.compare(newPassword, this.password);
};

// Method to check if password is expired
userSchema.methods.isPasswordExpired = function () {
  if (!this.passwordExpiresAt) {
    return false;
  }
  return this.passwordExpiresAt < Date.now();
};

// Method to get days until password expires
userSchema.methods.getDaysUntilPasswordExpiry = function () {
  if (!this.passwordExpiresAt) {
    return null;
  }
  const now = new Date();
  const expiryDate = new Date(this.passwordExpiresAt);
  const diffTime = expiryDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// Middleware to encrypt phone number before saving
userSchema.pre("save", async function () {
  try {
    // Encrypt phone if it's modified and not already encrypted
    if (this.isModified("phone") && this.phone && !isEncrypted(this.phone)) {
      this.phone = encryptField(this.phone);
    }
  } catch (error) {
    // Log error but don't fail the save for encryption issues during development
    console.error("Error encrypting phone number:", error.message);
    // In production, you might want to throw this error
    // throw error;
  }
});

// Middleware to decrypt phone number after finding
userSchema.post("find", function (docs) {
  if (Array.isArray(docs)) {
    docs.forEach((doc) => {
      if (doc.phone && isEncrypted(doc.phone)) {
        try {
          doc.phone = decryptField(doc.phone);
        } catch (error) {
          console.error("Failed to decrypt phone:", error.message);
          doc.phone = null;
        }
      }
    });
  }
});

userSchema.post("findOne", function (doc) {
  if (doc && doc.phone && isEncrypted(doc.phone)) {
    try {
      doc.phone = decryptField(doc.phone);
    } catch (error) {
      console.error("Failed to decrypt phone:", error.message);
      doc.phone = null;
    }
  }
});

userSchema.post("findOneAndUpdate", function (doc) {
  if (doc && doc.phone && isEncrypted(doc.phone)) {
    try {
      doc.phone = decryptField(doc.phone);
    } catch (error) {
      console.error("Failed to decrypt phone:", error.message);
      doc.phone = null;
    }
  }
});

// Decrypt phone after save
userSchema.post("save", function (doc) {
  if (doc && doc.phone && isEncrypted(doc.phone)) {
    try {
      doc.phone = decryptField(doc.phone);
    } catch (error) {
      console.error("Failed to decrypt phone after save:", error.message);
      doc.phone = null;
    }
  }
});

const User = mongoose.model("User", userSchema);

export default User;
