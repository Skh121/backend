export const securityConfig = {
  // JWT Configuration
  jwt: {
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    issuer: 'shopping-platform',
    audience: 'shopping-platform-users',
  },

  // Password Configuration
  password: {
    bcryptRounds: 12,
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },

  // Rate Limiting Configuration
  rateLimit: {
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: 'Too many requests from this IP, please try again later.',
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5,
      message: 'Too many authentication attempts, please try again later.',
    },
    api: {
      windowMs: 15 * 60 * 1000,
      max: 50,
    },
  },

  // Account Lockout Configuration
  lockout: {
    maxFailedAttempts: 5,
    lockDuration: 30 * 60 * 1000, // 30 minutes
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
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  },

  // CORS Configuration
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    optionsSuccessStatus: 200,
  },

  // Cookie Configuration
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for refresh token
  },

  // CSRF Configuration
  csrf: {
    cookieName: 'csrf-token',
    headerName: 'x-csrf-token',
  },
};
