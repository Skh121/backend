import { z } from 'zod';
import { PRODUCT_CATEGORIES, ORDER_STATUS } from './constants.js';

// Password validation regex
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

// Authentication Schemas
export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(passwordRegex, 'Password must contain uppercase, lowercase, number, and special character'),
    firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
    lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
    captchaToken: z.string().min(1, 'CAPTCHA token is required'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
    captchaToken: z.string().min(1, 'CAPTCHA token is required'),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    pin: z.string().length(6, 'PIN must be 6 digits').regex(/^\d{6}$/, 'PIN must contain only digits'),
  }),
});

export const verify2FASchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    code: z.string().length(6, 'Code must be 6 digits'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required').optional(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    captchaToken: z.string().min(1, 'CAPTCHA token is required'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(passwordRegex, 'Password must contain uppercase, lowercase, number, and special character'),
  }),
});

// User Schemas
export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    phone: z.string().regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number').optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(passwordRegex, 'Password must contain uppercase, lowercase, number, and special character'),
  }),
});

// Product Schemas
export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Product name is required').max(200),
    description: z.string().min(1, 'Description is required').max(2000),
    price: z.number().positive('Price must be positive'),
    stock: z.number().int().nonnegative('Stock must be non-negative'),
    category: z.enum(Object.values(PRODUCT_CATEGORIES)),
    images: z.array(z.string().url()).min(1, 'At least one image is required').max(10),
    featured: z.boolean().optional(),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(2000).optional(),
    price: z.number().positive().optional(),
    stock: z.number().int().nonnegative().optional(),
    category: z.enum(Object.values(PRODUCT_CATEGORIES)).optional(),
    images: z.array(z.string().url()).min(1).max(10).optional(),
    featured: z.boolean().optional(),
  }),
});

export const getProductsSchema = z.object({
  query: z.object({
    page: z.preprocess((val) => val === '' ? undefined : val, z.string().regex(/^\d+$/).transform(Number).optional()),
    limit: z.preprocess((val) => val === '' ? undefined : val, z.string().regex(/^\d+$/).transform(Number).optional()),
    category: z.preprocess((val) => val === '' ? undefined : val, z.enum(Object.values(PRODUCT_CATEGORIES)).optional()),
    search: z.preprocess((val) => val === '' ? undefined : val, z.string().max(100).optional()),
    minPrice: z.preprocess((val) => val === '' ? undefined : val, z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional()),
    maxPrice: z.preprocess((val) => val === '' ? undefined : val, z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional()),
    sortBy: z.preprocess((val) => val === '' ? undefined : val, z.enum(['price', 'name', 'createdAt']).optional()),
    sortOrder: z.preprocess((val) => val === '' ? undefined : val, z.enum(['asc', 'desc']).optional()),
    featured: z.preprocess((val) => val === '' ? undefined : val, z.string().regex(/^(true|false)$/).transform(v => v === 'true').optional()),
  }).passthrough().optional().default({}),
});

export const productIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  }),
});

// Cart Schemas
export const addToCartSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
    quantity: z.number().int().positive('Quantity must be positive'),
  }),
});

export const updateCartItemSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
    quantity: z.number().int().nonnegative('Quantity must be non-negative'),
  }),
});

export const removeFromCartSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  }),
});

// Favorite Schemas
export const toggleFavoriteSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  }),
});

// Order Schemas
export const createOrderSchema = z.object({
  body: z.object({
    shippingAddress: z.object({
      street: z.string().min(1, 'Street is required').max(200),
      city: z.string().min(1, 'City is required').max(100),
      state: z.string().min(1, 'State is required').max(100),
      zipCode: z.string().min(1, 'Zip code is required').max(20),
      country: z.string().min(1, 'Country is required').max(100),
    }),
    phone: z.string().regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number'),
  }),
});

export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(Object.values(ORDER_STATUS)),
  }),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid order ID'),
  }),
});

export const getOrdersSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z.enum(Object.values(ORDER_STATUS)).optional(),
  }),
});

export const orderIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid order ID'),
  }),
});

// Payment Schemas
export const createPaymentIntentSchema = z.object({
  body: z.object({
    orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid order ID'),
  }),
});

// Admin Schemas
export const adminUserIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  }),
});

export const updateUserRoleSchema = z.object({
  body: z.object({
    role: z.enum(['user', 'admin']),
  }),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  }),
});

export const getUsersSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().max(100).optional(),
    role: z.enum(['user', 'admin']).optional(),
  }),
});
