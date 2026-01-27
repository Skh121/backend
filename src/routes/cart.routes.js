import express from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "../controllers/cart.controller.js";
import { authenticate, checkPasswordExpiry } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  addToCartSchema,
  updateCartItemSchema,
  removeFromCartSchema,
} from "../utils/validation.schemas.js";
import {
  logCartAdd,
  logCartUpdate,
  logCartRemove,
  logCartClear,
} from "../middleware/auditLog.js";

const router = express.Router();

// All cart routes require authentication and password expiry check
router.use(authenticate);
router.use(checkPasswordExpiry);

router.get("/", asyncHandler(getCart));

router.post(
  "/items",
  validate(addToCartSchema),
  logCartAdd,
  asyncHandler(addToCart),
);

router.put(
  "/items",
  validate(updateCartItemSchema),
  logCartUpdate,
  asyncHandler(updateCartItem),
);

router.delete(
  "/items",
  validate(removeFromCartSchema),
  logCartRemove,
  asyncHandler(removeFromCart),
);

router.delete("/", logCartClear, asyncHandler(clearCart));

export default router;
