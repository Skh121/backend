import express from "express";
import {
  getProfile,
  updateProfile,
  uploadProfileImage,
  deleteProfileImage,
  changePassword,
  // enable2FA, // DISABLED - Using TOTP instead
  // disable2FA, // DISABLED - Using TOTP instead
  getUserOrders,
} from "../controllers/user.controller.js";
import { authenticate, checkPasswordExpiry } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  uploadProfileImage as uploadProfileImageMiddleware,
  handleUploadError,
} from "../config/upload.js";
import {
  updateProfileSchema,
  changePasswordSchema,
  getOrdersSchema,
} from "../utils/validation.schemas.js";
import {
  logProfileUpdate,
  logPasswordChange,
  logProfileImageUpload,
  logProfileImageDelete,
  // log2FAChange, // DISABLED - Using TOTP instead
} from "../middleware/auditLog.js";

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// Check password expiry for all routes except change-password
router.use(checkPasswordExpiry);

router.get("/profile", asyncHandler(getProfile));

router.put(
  "/profile",
  validate(updateProfileSchema),
  logProfileUpdate,
  asyncHandler(updateProfile),
);

// Profile image upload
router.post(
  "/profile/image",
  uploadProfileImageMiddleware,
  handleUploadError,
  logProfileImageUpload,
  asyncHandler(uploadProfileImage),
);

router.delete(
  "/profile/image",
  logProfileImageDelete,
  asyncHandler(deleteProfileImage),
);

router.post(
  "/change-password",
  validate(changePasswordSchema),
  logPasswordChange,
  asyncHandler(changePassword),
);


router.get("/orders", validate(getOrdersSchema), asyncHandler(getUserOrders));

export default router;
