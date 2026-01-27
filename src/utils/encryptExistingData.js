/**
 * Utility script to encrypt existing PII data in the database
 * Run this once after deploying field-level encryption
 *
 * Usage: node src/utils/encryptExistingData.js
 */

import dotenv from 'dotenv';
import connectDatabase from '../config/database.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { encryptField, isEncrypted } from './encryption.js';
import { logger } from './logger.js';

dotenv.config();

const encryptExistingData = async () => {
  try {
    logger.info('Starting encryption of existing data...');

    // Connect to database
    await connectDatabase();

    // Encrypt User phone numbers
    logger.info('Encrypting user phone numbers...');
    const users = await User.find({ phone: { $ne: null, $exists: true } }).select('+phone');
    let userCount = 0;

    for (const user of users) {
      if (user.phone && !isEncrypted(user.phone)) {
        user.phone = encryptField(user.phone);
        await user.save();
        userCount++;
      }
    }
    logger.info(`Encrypted ${userCount} user phone numbers`);

    // Encrypt Order data
    logger.info('Encrypting order data...');
    const orders = await Order.find({});
    let orderCount = 0;

    for (const order of orders) {
      let modified = false;

      // Encrypt phone
      if (order.phone && !isEncrypted(order.phone)) {
        order.phone = encryptField(order.phone);
        modified = true;
      }

      // Encrypt shipping address
      if (order.shippingAddress) {
        if (order.shippingAddress.street && !isEncrypted(order.shippingAddress.street)) {
          order.shippingAddress.street = encryptField(order.shippingAddress.street);
          modified = true;
        }
        if (order.shippingAddress.city && !isEncrypted(order.shippingAddress.city)) {
          order.shippingAddress.city = encryptField(order.shippingAddress.city);
          modified = true;
        }
        if (order.shippingAddress.state && !isEncrypted(order.shippingAddress.state)) {
          order.shippingAddress.state = encryptField(order.shippingAddress.state);
          modified = true;
        }
        if (order.shippingAddress.zipCode && !isEncrypted(order.shippingAddress.zipCode)) {
          order.shippingAddress.zipCode = encryptField(order.shippingAddress.zipCode);
          modified = true;
        }
        if (order.shippingAddress.country && !isEncrypted(order.shippingAddress.country)) {
          order.shippingAddress.country = encryptField(order.shippingAddress.country);
          modified = true;
        }
      }

      if (modified) {
        await order.save();
        orderCount++;
      }
    }
    logger.info(`Encrypted ${orderCount} orders`);

    logger.info('Data encryption completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Error encrypting data:', error);
    process.exit(1);
  }
};

// Run the encryption
encryptExistingData();
