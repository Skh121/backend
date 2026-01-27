import AuditLog from '../models/AuditLog.js';

/**
 * Middleware to automatically log user actions
 * @param {string} category - Log category (user, product, order, etc.)
 * @param {string} action - Action performed
 * @param {function} getDetails - Optional function to extract details from req/res
 */
export const logAction = (category, action, getDetails = null) => {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      // Log the action after response
      setImmediate(async () => {
        try {
          const success = data?.success !== false;
          const details = getDetails ? getDetails(req, res, data) : {};

          await AuditLog.createLog({
            category,
            action,
            severity: success ? 'info' : 'warning',
            userId: req.user?.id,
            userEmail: req.user?.email,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            method: req.method,
            path: req.path,
            success,
            details,
          });
        } catch (error) {
          console.error('Failed to log action:', error);
        }
      });

      // Call original json method
      return originalJson(data);
    };

    next();
  };
};

/**
 * Middleware to log user profile updates
 */
export const logProfileUpdate = logAction('user', 'update_profile', (req) => ({
  fields: Object.keys(req.body),
}));

/**
 * Middleware to log password changes
 */
export const logPasswordChange = logAction('user', 'change_password');

/**
 * Middleware to log 2FA changes
 */
export const log2FAChange = (enabled) =>
  logAction('security', enabled ? 'enable_2fa' : 'disable_2fa');

/**
 * Middleware to log product views
 */
export const logProductView = (req, res, next) => {
  setImmediate(async () => {
    try {
      await AuditLog.createLog({
        category: 'product',
        action: 'view_product',
        severity: 'info',
        userId: req.user?.id,
        userEmail: req.user?.email,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        method: req.method,
        path: req.path,
        success: true,
        targetType: 'Product',
        targetId: req.params.id,
      });
    } catch (error) {
      console.error('Failed to log product view:', error);
    }
  });

  next();
};

/**
 * Middleware to log order creation
 */
export const logOrderCreation = logAction('order', 'create_order', (req, res, data) => ({
  orderId: data?.data?.order?._id,
  total: data?.data?.order?.total,
  itemCount: data?.data?.order?.items?.length,
}));

/**
 * Middleware to log payment processing
 */
export const logPayment = logAction('payment', 'process_payment', (req, res, data) => ({
  orderId: data?.data?.orderId,
  amount: data?.data?.amount,
  paymentMethod: req.body?.paymentMethod,
}));

/**
 * Middleware to log cart operations
 */
export const logCartAdd = logAction('cart', 'add_to_cart', (req) => ({
  productId: req.body?.productId,
  quantity: req.body?.quantity,
}));

export const logCartUpdate = logAction('cart', 'update_cart_item', (req) => ({
  productId: req.body?.productId,
  quantity: req.body?.quantity,
}));

export const logCartRemove = logAction('cart', 'remove_from_cart', (req) => ({
  productId: req.body?.productId,
}));

export const logCartClear = logAction('cart', 'clear_cart');

/**
 * Middleware to log favorites operations
 */
export const logFavoriteToggle = logAction('favorite', 'toggle_favorite', (req, res, data) => ({
  productId: req.body?.productId,
  added: data?.data?.isFavorite,
}));

/**
 * Middleware to log profile image operations
 */
export const logProfileImageUpload = logAction('profile', 'upload_profile_image');
export const logProfileImageDelete = logAction('profile', 'delete_profile_image');

export default {
  logAction,
  logProfileUpdate,
  logPasswordChange,
  log2FAChange,
  logProductView,
  logOrderCreation,
  logPayment,
  logCartAdd,
  logCartUpdate,
  logCartRemove,
  logCartClear,
  logFavoriteToggle,
  logProfileImageUpload,
  logProfileImageDelete,
};
