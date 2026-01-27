import express from "express";
import {
  getFavorites,
  toggleFavorite,
  checkFavorite,
} from "../controllers/favorite.controller.js";
import { authenticate, checkPasswordExpiry } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { toggleFavoriteSchema } from "../utils/validation.schemas.js";
import { logFavoriteToggle } from "../middleware/auditLog.js";

const router = express.Router();

// All favorite routes require authentication and password expiry check
router.use(authenticate);
router.use(checkPasswordExpiry);

router.get("/", asyncHandler(getFavorites));

router.post(
  "/toggle",
  validate(toggleFavoriteSchema),
  logFavoriteToggle,
  asyncHandler(toggleFavorite),
);

router.get("/check/:productId", asyncHandler(checkFavorite));

export default router;
