import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

const connectDatabase = async () => {
  try {
    const options = {
      // Security configurations
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
      // Prevent injection attacks through connection string
      authSource: 'admin',
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

export default connectDatabase;
