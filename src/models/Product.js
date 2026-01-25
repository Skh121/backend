import mongoose from 'mongoose';
import { PRODUCT_CATEGORIES } from '../utils/constants.js';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      maxlength: 2000,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
    stock: {
      type: Number,
      required: [true, 'Product stock is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      enum: Object.values(PRODUCT_CATEGORIES),
    },
    images: {
      type: [String],
      required: [true, 'At least one product image is required'],
      validate: {
        validator: function (v) {
          return v && v.length > 0 && v.length <= 10;
        },
        message: 'Product must have 1-10 images',
      },
    },
    featured: {
      type: Boolean,
      default: false,
    },
    // SEO fields
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    // Statistics
    views: {
      type: Number,
      default: 0,
    },
    purchases: {
      type: Number,
      default: 0,
    },
    // Product availability
    isActive: {
      type: Boolean,
      default: true,
    },
    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance (slug index auto-created by unique: true)
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ name: 'text', description: 'text' }); // Text search

// Generate slug from name before saving
productSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

// Virtual for stock status
productSchema.virtual('inStock').get(function () {
  return this.stock > 0;
});

// Method to check if product has sufficient stock
productSchema.methods.hasSufficientStock = function (quantity) {
  return this.stock >= quantity;
};

// Method to reduce stock
productSchema.methods.reduceStock = async function (quantity) {
  if (!this.hasSufficientStock(quantity)) {
    throw new Error('Insufficient stock');
  }
  this.stock -= quantity;
  this.purchases += 1;
  await this.save();
};

// Method to increase stock
productSchema.methods.increaseStock = async function (quantity) {
  this.stock += quantity;
  await this.save();
};

const Product = mongoose.model('Product', productSchema);

export default Product;
