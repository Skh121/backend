import Order from '../models/Order.js';
import { createPaymentIntent } from '../services/payment.service.js';
import { verifyWebhookSignature } from '../services/payment.service.js';
import { completeOrder } from './order.controller.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

/**
 * Create payment intent for order
 * POST /api/payment/create-intent
 */
export const createIntent = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    // Find order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.ORDER_NOT_FOUND,
      });
    }

    // Ensure user owns the order
    if (order.user.toString() !== req.user.id) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.FORBIDDEN,
      });
    }

    // Check if order is already paid
    if (order.paymentStatus === 'succeeded') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Order is already paid',
      });
    }

    // Create payment intent
    const paymentIntent = await createPaymentIntent(
      order.totalPrice,
      'usd',
      {
        orderId: order._id.toString(),
        userId: req.user.id,
        orderNumber: order.orderNumber,
      }
    );

    // Update order with payment intent ID
    order.stripePaymentIntentId = paymentIntent.id;
    order.paymentStatus = 'processing';
    await order.save();

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Stripe webhook handler
 * POST /api/payment/webhook
 */
export const handleWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];

  try {
    // Verify webhook signature
    const event = verifyWebhookSignature(req.body, signature);

    logger.info('Stripe webhook received:', { type: event.type });

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'payment_intent.canceled':
        await handlePaymentCanceled(event.data.object);
        break;

      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Webhook error',
    });
  }
};

/**
 * Handle successful payment
 */
const handlePaymentSuccess = async (paymentIntent) => {
  try {
    const orderId = paymentIntent.metadata.orderId;

    if (!orderId) {
      logger.error('No orderId in payment intent metadata');
      return;
    }

    // Complete the order
    const order = await completeOrder(orderId, paymentIntent.id);

    if (order) {
      logger.info(`Payment succeeded for order ${order.orderNumber}`);
    }
  } catch (error) {
    logger.error('Error handling payment success:', error);
  }
};

/**
 * Handle failed payment
 */
const handlePaymentFailed = async (paymentIntent) => {
  try {
    const orderId = paymentIntent.metadata.orderId;

    if (!orderId) {
      logger.error('No orderId in payment intent metadata');
      return;
    }

    const order = await Order.findById(orderId);

    if (order) {
      order.paymentStatus = 'failed';
      await order.save();

      logger.warn(`Payment failed for order ${order.orderNumber}`);
    }
  } catch (error) {
    logger.error('Error handling payment failure:', error);
  }
};

/**
 * Handle canceled payment
 */
const handlePaymentCanceled = async (paymentIntent) => {
  try {
    const orderId = paymentIntent.metadata.orderId;

    if (!orderId) {
      logger.error('No orderId in payment intent metadata');
      return;
    }

    const order = await Order.findById(orderId);

    if (order) {
      order.paymentStatus = 'cancelled';
      order.status = 'cancelled';
      await order.save();

      logger.info(`Payment cancelled for order ${order.orderNumber}`);
    }
  } catch (error) {
    logger.error('Error handling payment cancellation:', error);
  }
};

export default {
  createIntent,
  handleWebhook,
};
