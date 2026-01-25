import Stripe from "stripe";
import { logger } from "../utils/logger.js";

let stripeInstance = null;

const initializeStripe = () => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      logger.warn("Stripe secret key not configured");
      return null;
    }

    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
      typescript: false,
    });

    logger.info("Stripe initialized successfully");
    return stripeInstance;
  } catch (error) {
    logger.error("Stripe initialization error:", error.message);
    return null;
  }
};

const getStripe = () => {
  if (!stripeInstance) {
    return initializeStripe();
  }
  return stripeInstance;
};

export { initializeStripe, getStripe };
