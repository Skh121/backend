import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
    totalItems: {
      type: Number,
      default: 0,
    },
    totalPrice: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries (user index auto-created by unique: true)

// Calculate totals before saving
cartSchema.pre('save', function (next) {
  this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
  this.totalPrice = this.items.reduce((total, item) => total + item.price * item.quantity, 0);
  next();
});

// Method to add item to cart
cartSchema.methods.addItem = async function (product, quantity) {
  const existingItemIndex = this.items.findIndex(
    (item) => item.product.toString() === product._id.toString()
  );

  if (existingItemIndex >= 0) {
    // Update existing item
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].price = product.price;
  } else {
    // Add new item
    this.items.push({
      product: product._id,
      quantity,
      price: product.price,
    });
  }

  await this.save();
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = async function (productId, quantity) {
  const item = this.items.find((item) => item.product.toString() === productId.toString());

  if (!item) {
    throw new Error('Item not found in cart');
  }

  if (quantity === 0) {
    this.items = this.items.filter((item) => item.product.toString() !== productId.toString());
  } else {
    item.quantity = quantity;
  }

  await this.save();
};

// Method to remove item from cart
cartSchema.methods.removeItem = async function (productId) {
  this.items = this.items.filter((item) => item.product.toString() !== productId.toString());
  await this.save();
};

// Method to clear cart
cartSchema.methods.clearCart = async function () {
  this.items = [];
  await this.save();
};

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
