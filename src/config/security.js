export const securityConfig = {
  // JWT Configuration
  jwt: {
    accessTokenExpiry: "15m",
    refreshTokenExpiry: "7d",
    sessionIdleTimeout: 15 * 60 * 1000, // 15 minutes idle timeout
    issuer: "shopping-platform",
    audience: "shopping-platform-users",
  },

  // Password Configuration
  password: {
    bcryptRounds: 12,
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    expiryDays: 90, // Password expires after 90 days
    expiryWarningDays: 14, // Warn user 14 days before expiry
  },

  // Rate Limiting Configuration
  rateLimit: {
    global: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: process.env.NODE_ENV === "development" ? 5000 : 100, // Even higher in dev
      message: "Too many requests from this IP, please try again later.",
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 5 minutes
      max: 10, // 10 attempts allowed (allows account lock message to show first)
      message:
        "Too many attempts from this IP, please try again after 15 mins.",
    },
    api: {
      windowMs: 5 * 60 * 1000,
      max: process.env.NODE_ENV === "development" ? 2000 : 50, // Higher in dev
    },
  },

  // Account Lockout Configuration
  lockout: {
    maxFailedAttempts: 5,
    lockDuration: 5 * 60 * 1000, // 5 minutes
  },

  // 2FA Configuration
  twoFactor: {
    codeLength: 6,
    codeExpiry: 10 * 60 * 1000, // 10 minutes
  },

  // Email Verification Configuration
  emailVerification: {
    tokenExpiry: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Password Reset Configuration
  passwordReset: {
    tokenExpiry: 60 * 60 * 1000, // 1 hour
  },

  // CAPTCHA Configuration
  captcha: {
    scoreThreshold: 0.5, // reCAPTCHA v3 score threshold
  },

  // File Upload Configuration
  fileUpload: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
  },

  // CORS Configuration
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    optionsSuccessStatus: 200,
  },

  // Cookie Configuration
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for refresh token
  },

  // CSRF Configuration
  csrf: {
    cookieName: "csrf-token",
    headerName: "x-csrf-token",
  },
};
