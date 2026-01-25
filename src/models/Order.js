import mongoose from "mongoose";
import { ORDER_STATUS, PAYMENT_STATUS } from "../utils/constants.js";
import {
  encryptField,
  decryptField,
  isEncrypted,
} from "../utils/encryption.js";

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
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
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  zipCode: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
});

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderNumber: {
      type: String,
      unique: true,
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
  },
);

// Indexes for better query performance (orderNumber index auto-created by unique: true)
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ stripePaymentIntentId: 1 });

// Generate unique order number
orderSchema.pre("save", async function () {
  if (!this.orderNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.orderNumber = `ORD-${timestamp}-${random}`;
  }

  // Validate and encrypt phone if modified and not already encrypted
  if (this.isModified("phone") && this.phone && !isEncrypted(this.phone)) {
    if (this.phone.length > 20) {
      throw new Error("Phone number cannot exceed 20 characters");
    }
    this.phone = encryptField(this.phone);
  }

  // Validate and encrypt shipping address fields if modified
  if (this.isModified("shippingAddress") && this.shippingAddress) {
    if (
      this.shippingAddress.street &&
      !isEncrypted(this.shippingAddress.street)
    ) {
      if (this.shippingAddress.street.length > 200) {
        throw new Error("Street address cannot exceed 200 characters");
      }
      this.shippingAddress.street = encryptField(this.shippingAddress.street);
    }
    if (this.shippingAddress.city && !isEncrypted(this.shippingAddress.city)) {
      if (this.shippingAddress.city.length > 100) {
        throw new Error("City cannot exceed 100 characters");
      }
      this.shippingAddress.city = encryptField(this.shippingAddress.city);
    }
    if (
      this.shippingAddress.state &&
      !isEncrypted(this.shippingAddress.state)
    ) {
      if (this.shippingAddress.state.length > 100) {
        throw new Error("State cannot exceed 100 characters");
      }
      this.shippingAddress.state = encryptField(this.shippingAddress.state);
    }
    if (
      this.shippingAddress.zipCode &&
      !isEncrypted(this.shippingAddress.zipCode)
    ) {
      if (this.shippingAddress.zipCode.length > 20) {
        throw new Error("Zip code cannot exceed 20 characters");
      }
      this.shippingAddress.zipCode = encryptField(this.shippingAddress.zipCode);
    }
    if (
      this.shippingAddress.country &&
      !isEncrypted(this.shippingAddress.country)
    ) {
      if (this.shippingAddress.country.length > 100) {
        throw new Error("Country cannot exceed 100 characters");
      }
      this.shippingAddress.country = encryptField(this.shippingAddress.country);
    }
  }
});

// Calculate pricing
orderSchema.methods.calculatePricing = function () {
  this.itemsPrice = this.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
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

// Helper function to decrypt order PII fields
const decryptOrderFields = (doc) => {
  if (!doc) return;

  try {
    // Decrypt phone
    if (doc.phone && isEncrypted(doc.phone)) {
      doc.phone = decryptField(doc.phone);
    }

    // Decrypt shipping address
    if (doc.shippingAddress) {
      if (
        doc.shippingAddress.street &&
        isEncrypted(doc.shippingAddress.street)
      ) {
        doc.shippingAddress.street = decryptField(doc.shippingAddress.street);
      }
      if (doc.shippingAddress.city && isEncrypted(doc.shippingAddress.city)) {
        doc.shippingAddress.city = decryptField(doc.shippingAddress.city);
      }
      if (doc.shippingAddress.state && isEncrypted(doc.shippingAddress.state)) {
        doc.shippingAddress.state = decryptField(doc.shippingAddress.state);
      }
      if (
        doc.shippingAddress.zipCode &&
        isEncrypted(doc.shippingAddress.zipCode)
      ) {
        doc.shippingAddress.zipCode = decryptField(doc.shippingAddress.zipCode);
      }
      if (
        doc.shippingAddress.country &&
        isEncrypted(doc.shippingAddress.country)
      ) {
        doc.shippingAddress.country = decryptField(doc.shippingAddress.country);
      }
    }
  } catch (error) {
    console.error("Failed to decrypt order fields:", error.message);
  }
};

// Middleware to decrypt fields after finding
orderSchema.post("find", function (docs) {
  if (Array.isArray(docs)) {
    docs.forEach(decryptOrderFields);
  }
});

orderSchema.post("findOne", function (doc) {
  decryptOrderFields(doc);
});

orderSchema.post("findOneAndUpdate", function (doc) {
  decryptOrderFields(doc);
});

const Order = mongoose.model("Order", orderSchema);

export default Order;
