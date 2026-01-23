import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';

// Load environment variables
dotenv.config();

// Import configurations
import connectDatabase from './config/database.js';
import { connectRedis } from './config/redis.js';
import { initializeStripe } from './config/stripe.js';
import { securityConfig } from './config/security.js';

// Import middleware
import { helmetConfig } from './middleware/helmet.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { generateCSRFToken, verifyCSRFToken, getCSRFToken } from './middleware/csrf.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Import utilities
import { logger } from './utils/logger.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import productRoutes from './routes/product.routes.js';
import cartRoutes from './routes/cart.routes.js';
import favoriteRoutes from './routes/favorite.routes.js';
import orderRoutes from './routes/order.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import adminRoutes from './routes/admin.routes.js';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (for rate limiting and IP detection behind reverse proxy)
app.set('trust proxy', 1);

// Security headers
app.use(helmetConfig);

// CORS configuration
app.use(cors(securityConfig.cors));

// Stripe webhook route - must be before body parsing (needs raw body)
app.use('/api/payment', paymentRoutes);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Rate limiting (must be after trust proxy)
app.use(globalRateLimiter);

// Input sanitization (prevent NoSQL injection and XSS)
app.use(sanitizeInput);

// CSRF protection
app.use(generateCSRFToken);
app.get('/api/csrf-token', getCSRFToken);
app.use(verifyCSRFToken);

// Request logging middleware (non-sensitive data only)
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
// Note: /api/payment is mounted earlier for webhook handling

// 404 handler
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Connect to Redis (optional for development)
    await connectRedis();

    // Initialize Stripe (optional for development)
    initializeStripe();

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

export default app;
