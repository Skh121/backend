import express from "express";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getAllUsers,
  getUserById,
  updateUserRole,
  suspendUser,
  unsuspendUser,
  deleteUser,
  getAllOrders,
  updateOrderStatus,
  getDashboardStats,
} from "../controllers/admin.controller.js";
import { adminOnly, checkPasswordExpiry } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { uploadProductImages, handleUploadError } from "../config/upload.js";
import {
  createProductSchema,
  updateProductSchema,
  productIdSchema,
  getProductsSchema,
  getUsersSchema,
  adminUserIdSchema,
  updateUserRoleSchema,
  getOrdersSchema,
  updateOrderStatusSchema,
} from "../utils/validation.schemas.js";

const router = express.Router();

// All admin routes require admin role and password expiry check
router.use(adminOnly);
router.use(checkPasswordExpiry);

// ==================== DASHBOARD ====================

router.get("/dashboard/stats", asyncHandler(getDashboardStats));

// ==================== PRODUCT MANAGEMENT ====================

router.get(
  "/products",
  validate(getProductsSchema),
  asyncHandler(getAllProducts),
);

router.post(
  "/products",
  uploadProductImages,
  handleUploadError,
  asyncHandler(createProduct),
);

router.put(
  "/products/:id",
  validate(productIdSchema),
  uploadProductImages,
  handleUploadError,
  asyncHandler(updateProduct),
);

router.delete(
  "/products/:id",
  validate(productIdSchema),
  asyncHandler(deleteProduct),
);

// ==================== USER MANAGEMENT ====================

router.get("/users", validate(getUsersSchema), asyncHandler(getAllUsers));

router.get(
  "/users/:id",
  validate(adminUserIdSchema),
  asyncHandler(getUserById),
);

router.patch(
  "/users/:id/role",
  validate(updateUserRoleSchema),
  asyncHandler(updateUserRole),
);

router.post(
  "/users/:id/suspend",
  validate(adminUserIdSchema),
  asyncHandler(suspendUser),
);

router.post(
  "/users/:id/unsuspend",
  validate(adminUserIdSchema),
  asyncHandler(unsuspendUser),
);

router.delete(
  "/users/:id",
  validate(adminUserIdSchema),
  asyncHandler(deleteUser),
);

// ==================== ORDER MANAGEMENT ====================

router.get("/orders", validate(getOrdersSchema), asyncHandler(getAllOrders));

router.patch(
  "/orders/:id/status",
  validate(updateOrderStatusSchema),
  asyncHandler(updateOrderStatus),
);

export default router;
