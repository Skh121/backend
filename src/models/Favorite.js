import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Compound index to ensure uniqueness and faster queries
favoriteSchema.index({ user: 1 }, { unique: true });
favoriteSchema.index({ user: 1, products: 1 });

// Method to add product to favorites
favoriteSchema.methods.addProduct = async function (productId) {
  if (!this.products.includes(productId)) {
    this.products.push(productId);
    await this.save();
  }
};

// Method to remove product from favorites
favoriteSchema.methods.removeProduct = async function (productId) {
  this.products = this.products.filter(
    (id) => id.toString() !== productId.toString(),
  );
  await this.save();
};

// Method to check if product is favorited
favoriteSchema.methods.isFavorited = function (productId) {
  return this.products.some((id) => id.toString() === productId.toString());
};

// Method to toggle favorite status
favoriteSchema.methods.toggleProduct = async function (productId) {
  if (this.isFavorited(productId)) {
    await this.removeProduct(productId);
    return false; // Removed
  } else {
    await this.addProduct(productId);
    return true; // Added
  }
};

const Favorite = mongoose.model("Favorite", favoriteSchema);

export default Favorite;
