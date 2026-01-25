import mongoose from 'mongoose';
import { ORDER_STATUS, PAYMENT_STATUS } from '../utils/constants.js';

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  image: {
    type: String,
    required: true,
  },
});

const shippingAddressSchema = new mongoose.Schema({
  street: {
    type: String,
    required: true,
    maxlength: 200,
  },
  city: {
    type: String,
    required: true,
    maxlength: 100,
  },
  state: {
    type: String,
    required: true,
    maxlength: 100,
  },
  zipCode: {
    type: String,
    required: true,
    maxlength: 20,
  },
  country: {
    type: String,
    required: true,
    maxlength: 100,
  },
});

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    items: [orderItemSchema],
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },

    // Pricing
    itemsPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    taxPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    shippingPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0,
    },

    // Order status
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
    },

    // Payment
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    stripePaymentIntentId: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },

    // Shipping
    shippedAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    trackingNumber: {
      type: String,
      default: null,
    },

    // Notes
    customerNotes: {
      type: String,
      maxlength: 500,
    },
    adminNotes: {
      type: String,
      maxlength: 1000,
    },

    // Cancellation
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance (orderNumber index auto-created by unique: true)
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ stripePaymentIntentId: 1 });

// Generate unique order number
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.orderNumber = `ORD-${timestamp}-${random}`;
  }
  next();
});

// Calculate pricing
orderSchema.methods.calculatePricing = function () {
  this.itemsPrice = this.items.reduce((total, item) => total + item.price * item.quantity, 0);
  this.taxPrice = this.itemsPrice * 0.1; // 10% tax
  this.shippingPrice = this.itemsPrice > 100 ? 0 : 10; // Free shipping over $100
  this.totalPrice = this.itemsPrice + this.taxPrice + this.shippingPrice;
};

// Method to mark order as paid
orderSchema.methods.markAsPaid = async function (paymentIntentId) {
  this.paymentStatus = PAYMENT_STATUS.SUCCEEDED;
  this.status = ORDER_STATUS.PAID;
  this.stripePaymentIntentId = paymentIntentId;
  this.paidAt = new Date();
  await this.save();
};

// Method to mark order as shipped
orderSchema.methods.markAsShipped = async function (trackingNumber) {
  this.status = ORDER_STATUS.SHIPPED;
  this.trackingNumber = trackingNumber;
  this.shippedAt = new Date();
  await this.save();
};

// Method to mark order as delivered
orderSchema.methods.markAsDelivered = async function () {
  this.status = ORDER_STATUS.DELIVERED;
  this.deliveredAt = new Date();
  await this.save();
};

// Method to cancel order
orderSchema.methods.cancelOrder = async function (reason) {
  this.status = ORDER_STATUS.CANCELLED;
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  await this.save();
};

const Order = mongoose.model('Order', orderSchema);

export default Order;
