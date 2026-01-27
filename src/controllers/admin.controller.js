import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { logAdminAction } from "../services/audit.service.js";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../utils/constants.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== PRODUCT MANAGEMENT ====================

/**
 * Create product (Admin only)
 * POST /api/admin/products
 */
export const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, stock, category, images, featured } =
      req.body;

    // Handle uploaded files
    let productImages = [];
    if (req.files && req.files.length > 0) {
      productImages = req.files.map((file) => file.path);
    } else if (images) {
      // Support both array and comma-separated string
      productImages = Array.isArray(images)
        ? images
        : images
            .split(",")
            .map((img) => img.trim())
            .filter(Boolean);
    }

    if (productImages.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "At least one product image is required",
      });
    }

    const product = await Product.create({
      name,
      description,
      price: parseFloat(price),
      stock: parseInt(stock),
      category,
      images: productImages,
      featured: featured === "true" || featured === true || false,
      createdBy: req.user.id,
    });

    logAdminAction("create_product", req, product);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: SUCCESS_MESSAGES.PRODUCT_CREATED,
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product (Admin only)
 * PUT /api/admin/products/:id
 */
export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.PRODUCT_NOT_FOUND,
      });
    }

    const oldData = { ...product.toObject() };

    // Update fields
    const {
      name,
      description,
      price,
      stock,
      category,
      images,
      featured,
      isActive,
      keepExistingImages,
    } = req.body;

    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = parseFloat(price);
    if (stock !== undefined) product.stock = parseInt(stock);
    if (category !== undefined) product.category = category;
    if (featured !== undefined)
      product.featured = featured === "true" || featured === true;
    if (isActive !== undefined)
      product.isActive = isActive === "true" || isActive === true;

    // Handle images
    let newImages = [];
    if (req.files && req.files.length > 0) {
      newImages = req.files.map((file) => file.path);
    }

    // Parse existing images to keep
    let existingImages = [];
    if (keepExistingImages) {
      try {
        existingImages = JSON.parse(keepExistingImages);
      } catch {
        existingImages = [];
      }
    }

    // Combine existing and new images
    if (newImages.length > 0 || existingImages.length > 0) {
      product.images = [...existingImages, ...newImages];
    } else if (images !== undefined) {
      // Support both array and comma-separated string from URL inputs
      product.images = Array.isArray(images)
        ? images
        : images
            .split(",")
            .map((img) => img.trim())
            .filter(Boolean);
    }

    product.updatedBy = req.user.id;
    await product.save();

    logAdminAction("update_product", req, product, {
      oldData,
      newData: product.toObject(),
    });

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.PRODUCT_UPDATED,
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product (Admin only)
 * DELETE /api/admin/products/:id
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.PRODUCT_NOT_FOUND,
      });
    }

    logAdminAction("delete_product", req, product);

    await product.deleteOne();

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.PRODUCT_DELETED,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all products (Admin - includes inactive)
 * GET /api/admin/products
 */
export const getAllProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.category) query.category = req.query.category;
    if (req.query.isActive !== undefined)
      query.isActive = req.query.isActive === "true";

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "email firstName lastName")
        .populate("updatedBy", "email firstName lastName"),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== USER MANAGEMENT ====================

/**
 * Get all users (Admin only)
 * GET /api/admin/users
 */
export const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.role) {
      query.role = req.query.role;
    }

    if (req.query.search) {
      query.$or = [
        { email: { $regex: req.query.search, $options: "i" } },
        { firstName: { $regex: req.query.search, $options: "i" } },
        { lastName: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "-password -refreshTokenHash -emailVerificationToken -passwordResetToken -twoFactorCode",
        ),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID (Admin only)
 * GET /api/admin/users/:id
 */
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -refreshTokenHash -emailVerificationToken -passwordResetToken -twoFactorCode",
    );

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user role (Admin only)
 * PATCH /api/admin/users/:id/role
 */
export const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    logAdminAction("update_user_role", req, user, { oldRole, newRole: role });

    res.json({
      success: true,
      message: "User role updated successfully",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Suspend user (Admin only)
 * POST /api/admin/users/:id/suspend
 */
export const suspendUser = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    user.isSuspended = true;
    user.suspensionReason = reason;
    await user.save();

    logAdminAction("suspend_user", req, user, { reason });

    res.json({
      success: true,
      message: "User suspended successfully",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unsuspend user (Admin only)
 * POST /api/admin/users/:id/unsuspend
 */
export const unsuspendUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    user.isSuspended = false;
    user.suspensionReason = null;
    await user.save();

    logAdminAction("unsuspend_user", req, user);

    res.json({
      success: true,
      message: "User unsuspended successfully",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user (Admin only)
 * DELETE /api/admin/users/:id
 */
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Prevent deleting self
    if (user._id.toString() === req.user.id) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    logAdminAction("delete_user", req, user);

    await user.deleteOne();

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ==================== ORDER MANAGEMENT ====================

/**
 * Get all orders (Admin only)
 * GET /api/admin/orders
 */
export const getAllOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status) {
      query.status = req.query.status;
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "email firstName lastName")
        .populate("items.product", "name images"),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order status (Admin only)
 * PATCH /api/admin/orders/:id/status
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.ORDER_NOT_FOUND,
      });
    }

    const oldStatus = order.status;
    order.status = status;

    // Update shipping/delivery timestamps
    if (status === "shipped" && !order.shippedAt) {
      order.shippedAt = new Date();
    }

    if (status === "delivered" && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }

    await order.save();

    logAdminAction("update_order_status", req, order, {
      oldStatus,
      newStatus: status,
    });

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.ORDER_UPDATED,
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard statistics (Admin only)
 * GET /api/admin/dashboard/stats
 */
export const getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      pendingOrders,
      totalRevenue,
      recentOrders,
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Order.countDocuments({
        status: { $in: ["pending", "paid", "processing"] },
      }),
      Order.aggregate([
        { $match: { paymentStatus: "succeeded" } },
        { $group: { _id: null, total: { $sum: "$totalPrice" } } },
      ]),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("user", "email firstName lastName")
        .populate("items.product", "name"),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalProducts,
        totalOrders,
        pendingOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        recentOrders,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
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
};
