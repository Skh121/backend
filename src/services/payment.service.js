import { getStripe } from "../config/stripe.js";
import { logger } from "../utils/logger.js";

/**
 * Create Stripe payment intent
 * @param {number} amount - Amount in cents
 * @param {string} currency - Currency code (e.g., 'usd')
 * @param {object} metadata - Additional metadata
 * @returns {Promise<object>} Payment intent object
 */
export const createPaymentIntent = async (
  amount,
  currency = "usd",
  metadata = {},
) => {
  try {
    const stripe = getStripe();

    if (!stripe) {
      throw new Error("Stripe is not configured");
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    logger.info("Payment intent created:", { id: paymentIntent.id, amount });

    return paymentIntent;
  } catch (error) {
    logger.error("Error creating payment intent:", error);
    throw error;
  }
};

/**
 * Retrieve payment intent
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<object>} Payment intent object
 */
export const retrievePaymentIntent = async (paymentIntentId) => {
  try {
    const stripe = getStripe();

    if (!stripe) {
      throw new Error("Stripe is not configured");
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return paymentIntent;
  } catch (error) {
    logger.error("Error retrieving payment intent:", error);
    throw error;
  }
};

/**
 * Cancel payment intent
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<object>} Cancelled payment intent
 */
export const cancelPaymentIntent = async (paymentIntentId) => {
  try {
    const stripe = getStripe();

    if (!stripe) {
      throw new Error("Stripe is not configured");
    }

    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

    logger.info("Payment intent cancelled:", { id: paymentIntent.id });

    return paymentIntent;
  } catch (error) {
    logger.error("Error cancelling payment intent:", error);
    throw error;
  }
};

/**
 * Create refund
 * @param {string} paymentIntentId - Payment intent ID
 * @param {number} amount - Amount to refund in cents (optional, defaults to full refund)
 * @returns {Promise<object>} Refund object
 */
export const createRefund = async (paymentIntentId, amount = null) => {
  try {
    const stripe = getStripe();

    if (!stripe) {
      throw new Error("Stripe is not configured");
    }

    const refundData = { payment_intent: paymentIntentId };
    if (amount !== null) {
      refundData.amount = Math.round(amount * 100);
    }

    const refund = await stripe.refunds.create(refundData);

    logger.info("Refund created:", { id: refund.id, amount: refund.amount });

    return refund;
  } catch (error) {
    logger.error("Error creating refund:", error);
    throw error;
  }
};

/**
 * Verify Stripe webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Stripe signature header
 * @returns {object} Verified event object
 */
export const verifyWebhookSignature = (payload, signature) => {
  try {
    const stripe = getStripe();

    if (!stripe) {
      throw new Error("Stripe is not configured");
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error("Stripe webhook secret is not configured");
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );

    return event;
  } catch (error) {
    logger.error("Error verifying webhook signature:", error);
    throw error;
  }
};

export default {
  createPaymentIntent,
  retrievePaymentIntent,
  cancelPaymentIntent,
  createRefund,
  verifyWebhookSignature,
};
