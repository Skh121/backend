import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import configurations
import connectDatabase from "./config/database.js";
import { initializeStripe } from "./config/stripe.js";
import { securityConfig } from "./config/security.js";

// Import middleware
import { helmetConfig } from "./middleware/helmet.js";
import { globalRateLimiter } from "./middleware/rateLimiter.js";
import { sanitizeInput } from "./middleware/sanitize.js";
import {
  generateCSRFToken,
  verifyCSRFToken,
  getCSRFToken,
} from "./middleware/csrf.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

// Import utilities
import { logger } from "./utils/logger.js";

// Import routes
import authRoutes from "./routes/auth.routes.js";
import oauthRoutes from "./routes/oauth.routes.js";
import userRoutes from "./routes/user.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import favoriteRoutes from "./routes/favorite.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import totpRoutes from "./routes/totp.routes.js";
import sessionRoutes from "./routes/session.routes.js";
import gdprRoutes from "./routes/gdpr.routes.js";

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (for rate limiting and IP detection behind reverse proxy)
app.set("trust proxy", 1);

// Security headers
app.use(helmetConfig);

// CORS configuration
app.use(cors(securityConfig.cors));

// Cookie parser - MUST be before any routes that need authentication
app.use(cookieParser());

// Body parsing middleware
// Skip JSON parsing for Stripe webhook (it needs raw body for signature verification)
app.use((req, res, next) => {
  if (req.path === "/api/payment/webhook") {
    express.raw({ type: "application/json" })(req, res, next);
  } else {
    express.json({ limit: "10mb" })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting (must be after trust proxy)
app.use(globalRateLimiter);

// Input sanitization (prevent NoSQL injection and XSS)
app.use(sanitizeInput);

// Serve static uploaded files (before CSRF to avoid blocking)
app.use(
  "/uploads",
  (req, res, next) => {
    // Set CORS headers for uploaded files
    res.setHeader(
      "Access-Control-Allow-Origin",
      process.env.FRONTEND_URL || "http://localhost:5173",
    );
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "../uploads")),
);

// CSRF protection
app.use(generateCSRFToken);
app.get("/api/csrf-token", getCSRFToken);
app.use(verifyCSRFToken);

// Request logging middleware (non-sensitive data only)
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/auth", oauthRoutes); // OAuth routes (Google, etc.)
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes); // Moved here so it has access to cookie parser
app.use("/api/admin", adminRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/totp", totpRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/gdpr", gdprRoutes);

// 404 handler
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Initialize Stripe (optional for development)
    initializeStripe();

    // Start server
    app.listen(PORT, () => {
      logger.info(
        `Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
      );
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Promise Rejection:", err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  process.exit(1);
});

export default app;
