import helmet from "helmet";

/**
 * Security headers configuration using Helmet
 */
export const helmetConfig = helmet({
  // Cross-Origin-Resource-Policy: Allow cross-origin access to resources (for uploaded images)
  crossOriginResourcePolicy: { policy: "cross-origin" },

  // Cross-Origin-Opener-Policy: Allow popups for OAuth
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },

  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Stripe and reCAPTCHA
        "https://js.stripe.com",
        "https://www.google.com/recaptcha/",
        "https://www.gstatic.com/recaptcha/",
        "https://accounts.google.com",
        "https://apis.google.com",
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://accounts.google.com",
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: [
        "'self'",
        "data:",
        "https:", // Allow images from CDNs
        "https://lh3.googleusercontent.com", // Google profile images
      ],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://www.google.com/recaptcha/",
        "https://accounts.google.com",
        "https://oauth2.googleapis.com",
      ],
      frameSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://www.google.com/recaptcha/",
        "https://accounts.google.com",
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests:
        process.env.NODE_ENV === "production" ? [] : null,
    },
  },

  // Strict-Transport-Security (HSTS)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  // X-Frame-Options: Prevent clickjacking
  frameguard: {
    action: "deny",
  },

  // X-Content-Type-Options: Prevent MIME type sniffing
  noSniff: true,

  // X-XSS-Protection
  xssFilter: true,

  // Referrer-Policy
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },

  // Permissions-Policy (formerly Feature-Policy)
  permittedCrossDomainPolicies: {
    permittedPolicies: "none",
  },
});
