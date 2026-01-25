import express from "express";
import {
  createOrder,
  getOrderById,
  cancelOrder,
} from "../controllers/order.controller.js";
import { authenticate, checkPasswordExpiry } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  createOrderSchema,
  orderIdSchema,
} from "../utils/validation.schemas.js";
import { logOrderCreation, logAction } from "../middleware/auditLog.js";

const router = express.Router();

// All order routes require authentication and password expiry check
router.use(authenticate);
router.use(checkPasswordExpiry);

router.post(
  "/",
  validate(createOrderSchema),
  logOrderCreation,
  asyncHandler(createOrder),
);

router.get(
  "/:id",
  validate(orderIdSchema),
  logAction("order", "view_order", (req) => ({ orderId: req.params.id })),
  asyncHandler(getOrderById),
);

router.post(
  "/:id/cancel",
  validate(orderIdSchema),
  logAction("order", "cancel_order", (req) => ({ orderId: req.params.id })),
  asyncHandler(cancelOrder),
);

export default router;
