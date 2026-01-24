import helmet from 'helmet';

/**
 * Security headers configuration using Helmet
 */
export const helmetConfig = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Stripe and reCAPTCHA
        'https://js.stripe.com',
        'https://www.google.com/recaptcha/',
        'https://www.gstatic.com/recaptcha/',
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
      ],
      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com',
      ],
      imgSrc: [
        "'self'",
        'data:',
        'https:', // Allow images from CDNs
      ],
      connectSrc: [
        "'self'",
        'https://api.stripe.com',
        'https://www.google.com/recaptcha/',
      ],
      frameSrc: [
        "'self'",
        'https://js.stripe.com',
        'https://www.google.com/recaptcha/',
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
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
    action: 'deny',
  },

  // X-Content-Type-Options: Prevent MIME type sniffing
  noSniff: true,

  // X-XSS-Protection
  xssFilter: true,

  // Referrer-Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  // Permissions-Policy (formerly Feature-Policy)
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none',
  },
});
