import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../utils/constants.js";
import { logger } from "../utils/logger.js";

/**
 * Create order from cart
 * POST /api/orders
 */
export const createOrder = async (req, res, next) => {
  try {
    const { shippingAddress, phone, customerNotes } = req.body;

    // Additional validation for shipping address fields
    if (!shippingAddress || typeof shippingAddress !== "object") {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Valid shipping address is required",
      });
    }

    // Validate required shipping fields
    const requiredFields = ["street", "city", "state", "zipCode", "country"];
    for (const field of requiredFields) {
      if (
        !shippingAddress[field] ||
        typeof shippingAddress[field] !== "string" ||
        !shippingAddress[field].trim()
      ) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: `${field.charAt(0).toUpperCase() + field.slice(1)} is required`,
        });
      }
    }

    // Validate field lengths (before encryption)
    if (shippingAddress.street.trim().length > 200) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Street address is too long (max 200 characters)",
      });
    }
    if (shippingAddress.city.trim().length > 100) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "City name is too long (max 100 characters)",
      });
    }
    if (shippingAddress.state.trim().length > 100) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "State name is too long (max 100 characters)",
      });
    }
    if (shippingAddress.zipCode.trim().length > 20) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Zip code is too long (max 20 characters)",
      });
    }
    if (shippingAddress.country.trim().length > 100) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Country name is too long (max 100 characters)",
      });
    }

    // Validate phone number
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Phone number is required",
      });
    }
    if (phone.trim().length > 20) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Phone number is too long (max 20 characters)",
      });
    }

    // Validate customer notes if provided
    if (customerNotes && customerNotes.length > 500) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Customer notes are too long (max 500 characters)",
      });
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user.id }).populate(
      "items.product",
    );

    if (!cart || cart.items.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: ERROR_MESSAGES.CART_EMPTY,
      });
    }

    // Verify all products are still available and have sufficient stock
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);

      if (!product || !product.isActive) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: `Product "${item.product.name}" is no longer available`,
        });
      }

      if (!product.hasSufficientStock(item.quantity)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: `Insufficient stock for "${item.product.name}"`,
        });
      }
    }

    // Prepare order items
    const orderItems = cart.items.map((item) => ({
      product: item.product._id,
      name: item.product.name,
      quantity: item.quantity,
      price: item.product.price, // Use current price from product
      image: item.product.images[0] || "/placeholder.png",
    }));

    // Create order with trimmed data
    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      shippingAddress: {
        street: shippingAddress.street.trim(),
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        zipCode: shippingAddress.zipCode.trim(),
        country: shippingAddress.country.trim(),
      },
      phone: phone.trim(),
      customerNotes: customerNotes?.trim() || undefined,
    });

    // Calculate pricing
    order.calculatePricing();
    await order.save();

    // Populate order details
    await order.populate("items.product", "name images");

    logger.info(`Order created: ${order.orderNumber} for user ${req.user.id}`);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: SUCCESS_MESSAGES.ORDER_CREATED,
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get order by ID
 * GET /api/orders/:id
 */
export const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "items.product",
      "name images",
    );

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.ORDER_NOT_FOUND,
      });
    }

    // Ensure user can only access their own orders (unless admin)
    if (order.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.FORBIDDEN,
      });
    }

    res.json({
      success: true,
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Complete order after successful payment
 * Internal function, not exposed as route
 */
export const completeOrder = async (orderId, paymentIntentId) => {
  try {
    const order = await Order.findById(orderId).populate("items.product");

    if (!order) {
      logger.error(`Order not found: ${orderId}`);
      return null;
    }

    // Reduce stock for all products
    for (const item of order.items) {
      const product = await Product.findById(item.product._id);
      if (product) {
        await product.reduceStock(item.quantity);
      }
    }

    // Mark order as paid
    await order.markAsPaid(paymentIntentId);

    // Clear user's cart
    await Cart.findOneAndUpdate({ user: order.user }, { $set: { items: [] } });

    logger.info(`Order completed: ${orderId}`);

    return order;
  } catch (error) {
    logger.error("Error completing order:", error);
    throw error;
  }
};

/**
 * Cancel order
 * POST /api/orders/:id/cancel
 */
export const cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.ORDER_NOT_FOUND,
      });
    }

    // Ensure user can only cancel their own orders
    if (order.user.toString() !== req.user.id) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: ERROR_MESSAGES.FORBIDDEN,
      });
    }

    // Can only cancel pending or paid orders
    if (!["pending", "paid"].includes(order.status)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Order cannot be cancelled at this stage",
      });
    }

    // Cancel order
    await order.cancelOrder(reason);

    // Restore stock if order was paid
    if (order.paymentStatus === "succeeded") {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          await product.increaseStock(item.quantity);
        }
      }
    }

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createOrder,
  getOrderById,
  completeOrder,
  cancelOrder,
};
