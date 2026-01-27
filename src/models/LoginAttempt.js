import mongoose from "mongoose";

const loginAttemptSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    ip: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
    success: {
      type: Boolean,
      required: true,
      default: false,
    },
    failureReason: {
      type: String,
      enum: [
        "invalid_credentials",
        "account_locked",
        "email_not_verified",
        "account_suspended",
        "captcha_failed",
        "invalid_2fa_code",
        "other",
      ],
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries and cleanup
loginAttemptSchema.index({ email: 1, createdAt: -1 });
loginAttemptSchema.index({ ip: 1, createdAt: -1 });
loginAttemptSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
); // Auto-delete after 30 days

const LoginAttempt = mongoose.model("LoginAttempt", loginAttemptSchema);

export default LoginAttempt;
