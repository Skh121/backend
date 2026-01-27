import Favorite from "../models/Favorite.js";
import Product from "../models/Product.js";
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "../utils/constants.js";

/**
 * Get user's favorites
 * GET /api/favorites
 */
export const getFavorites = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    let favorite = await Favorite.findOne({ user: req.user.id }).populate(
      "products",
    );

    if (!favorite) {
      // Create empty favorites if doesn't exist
      favorite = await Favorite.create({ user: req.user.id, products: [] });
    }

    // Manual pagination for populated products
    const total = favorite.products.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProducts = favorite.products.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        products: paginatedProducts,
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
 * Toggle product in favorites
 * POST /api/favorites/toggle
 */
export const toggleFavorite = async (req, res, next) => {
  try {
    const { productId } = req.body;

    // Check if product exists
    const product = await Product.findById(productId);

    if (!product || !product.isActive) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: ERROR_MESSAGES.PRODUCT_NOT_FOUND,
      });
    }

    // Get or create favorites
    let favorite = await Favorite.findOne({ user: req.user.id });

    if (!favorite) {
      favorite = await Favorite.create({ user: req.user.id, products: [] });
    }

    // Toggle favorite
    const isAdded = await favorite.toggleProduct(productId);

    res.json({
      success: true,
      message: isAdded
        ? SUCCESS_MESSAGES.ITEM_ADDED_TO_FAVORITES
        : SUCCESS_MESSAGES.ITEM_REMOVED_FROM_FAVORITES,
      data: {
        isFavorited: isAdded,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if product is favorited
 * GET /api/favorites/check/:productId
 */
export const checkFavorite = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const favorite = await Favorite.findOne({ user: req.user.id });

    const isFavorited = favorite ? favorite.isFavorited(productId) : false;

    res.json({
      success: true,
      data: { isFavorited },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getFavorites,
  toggleFavorite,
  checkFavorite,
};
