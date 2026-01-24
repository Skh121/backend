export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
};

export const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

export const PRODUCT_CATEGORIES = {
  ELECTRONICS: 'electronics',
  CLOTHING: 'clothing',
  BOOKS: 'books',
  HOME: 'home',
  SPORTS: 'sports',
  TOYS: 'toys',
  FOOD: 'food',
  BEAUTY: 'beauty',
  OTHER: 'other',
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export const ERROR_MESSAGES = {
  // Authentication
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_LOCKED: 'Account locked due to multiple failed login attempts',
  EMAIL_NOT_VERIFIED: 'Please verify your email before logging in',
  INVALID_TOKEN: 'Invalid or expired token',
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'You do not have permission to perform this action',

  // User
  USER_NOT_FOUND: 'User not found',
  USER_ALREADY_EXISTS: 'User with this email already exists',
  INVALID_EMAIL: 'Invalid email format',
  WEAK_PASSWORD: 'Password does not meet security requirements',

  // Product
  PRODUCT_NOT_FOUND: 'Product not found',
  INSUFFICIENT_STOCK: 'Insufficient stock available',
  INVALID_PRODUCT_DATA: 'Invalid product data',

  // Cart
  CART_EMPTY: 'Cart is empty',
  CART_ITEM_NOT_FOUND: 'Item not found in cart',

  // Order
  ORDER_NOT_FOUND: 'Order not found',
  PAYMENT_FAILED: 'Payment processing failed',

  // General
  VALIDATION_ERROR: 'Validation error',
  SERVER_ERROR: 'Internal server error',
  RATE_LIMIT_EXCEEDED: 'Too many requests',
  CAPTCHA_FAILED: 'CAPTCHA verification failed',
  CSRF_INVALID: 'Invalid CSRF token',
};

export const SUCCESS_MESSAGES = {
  // Authentication
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  REGISTER_SUCCESS: 'Registration successful',
  EMAIL_VERIFIED: 'Email verified successfully',
  PASSWORD_RESET_EMAIL_SENT: 'Password reset email sent',
  PASSWORD_RESET_SUCCESS: 'Password reset successful',

  // User
  PROFILE_UPDATED: 'Profile updated successfully',

  // Product
  PRODUCT_CREATED: 'Product created successfully',
  PRODUCT_UPDATED: 'Product updated successfully',
  PRODUCT_DELETED: 'Product deleted successfully',

  // Cart
  ITEM_ADDED_TO_CART: 'Item added to cart',
  ITEM_UPDATED_IN_CART: 'Cart item updated',
  ITEM_REMOVED_FROM_CART: 'Item removed from cart',

  // Favorites
  ITEM_ADDED_TO_FAVORITES: 'Item added to favorites',
  ITEM_REMOVED_FROM_FAVORITES: 'Item removed from favorites',

  // Order
  ORDER_CREATED: 'Order created successfully',
  ORDER_UPDATED: 'Order updated successfully',
  PAYMENT_SUCCESS: 'Payment processed successfully',
};
