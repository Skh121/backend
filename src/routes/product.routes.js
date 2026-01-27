import express from "express";
import {
  getProducts,
  getProductById,
  getFeaturedProducts,
} from "../controllers/product.controller.js";
import { optionalAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  getProductsSchema,
  productIdSchema,
} from "../utils/validation.schemas.js";
import { logProductView } from "../middleware/auditLog.js";

const router = express.Router();

// Public routes
router.get("/featured", asyncHandler(getFeaturedProducts));

router.get(
  "/",
  optionalAuth,
  validate(getProductsSchema),
  asyncHandler(getProducts),
);

router.get(
  "/:id",
  optionalAuth,
  validate(productIdSchema),
  logProductView,
  asyncHandler(getProductById),
);

export default router;
