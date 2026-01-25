import express from "express";
import {
  createIntent,
  handleWebhook,
  confirmPayment,
} from "../controllers/payment.controller.js";
import { authenticate, checkPasswordExpiry } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { createPaymentIntentSchema } from "../utils/validation.schemas.js";
import { logAction } from "../middleware/auditLog.js";

const router = express.Router();

// Webhook endpoint - raw body parsing is handled in server.js
// Raw body is needed for signature verification
router.post("/webhook", handleWebhook);

// Protected routes
router.post(
  "/create-intent",
  authenticate,
  checkPasswordExpiry,
  validate(createPaymentIntentSchema),
  logAction("payment", "create_payment_intent", (req) => ({
    amount: req.body.amount,
  })),
  asyncHandler(createIntent),
);

// Confirm payment manually (fallback for development when webhooks don't work)
router.post(
  "/confirm-payment",
  authenticate,
  checkPasswordExpiry,
  logAction("payment", "confirm_payment", (req) => ({
    paymentIntentId: req.body.paymentIntentId,
  })),
  asyncHandler(confirmPayment),
);

export default router;
