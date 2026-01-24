import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../utils/constants.js';

/**
 * Get user's cart
 * GET /api/cart
 */
export const getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id }).populate('items.product');

    if (!cart) {
      // Create empty cart if doesn't exist
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    res.json({
      success: true,
      data: { cart },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add item to cart
 * POST /api/cart/items
 */
export const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    // Check if product exists and is active
    const product = await Product.findById(productId);

    if (!product || !product.isActive) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.PRODUCT_NOT_FOUND,
      });
    }

    // Check stock availability
    if (!product.hasSufficientStock(quantity)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: ERROR_MESSAGES.INSUFFICIENT_STOCK,
      });
    }

    // Get or create cart
    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    // Add item to cart
    await cart.addItem(product, quantity);

    // Populate and return updated cart
    cart = await Cart.findById(cart._id).populate('items.product');

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.ITEM_ADDED_TO_CART,
      data: { cart },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update cart item quantity
 * PUT /api/cart/items
 */
export const updateCartItem = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.CART_EMPTY,
      });
    }

    // If quantity > 0, check stock
    if (quantity > 0) {
      const product = await Product.findById(productId);

      if (!product || !product.isActive) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.PRODUCT_NOT_FOUND,
        });
      }

      if (!product.hasSufficientStock(quantity)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_STOCK,
        });
      }
    }

    // Update cart
    await cart.updateItemQuantity(productId, quantity);

    // Populate and return updated cart
    const updatedCart = await Cart.findById(cart._id).populate('items.product');

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.ITEM_UPDATED_IN_CART,
      data: { cart: updatedCart },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove item from cart
 * DELETE /api/cart/items
 */
export const removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.body;

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.CART_EMPTY,
      });
    }

    await cart.removeItem(productId);

    // Populate and return updated cart
    const updatedCart = await Cart.findById(cart._id).populate('items.product');

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.ITEM_REMOVED_FROM_CART,
      data: { cart: updatedCart },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear cart
 * DELETE /api/cart
 */
export const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.CART_EMPTY,
      });
    }

    await cart.clearCart();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: { cart },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
};
