import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { hashPassword } from '../utils/encryption.js';

dotenv.config();

const sampleProducts = [
  {
    name: 'iPhone 15 Pro Max',
    description: 'Latest Apple iPhone with A17 Pro chip, titanium design, and advanced camera system. Features 6.7-inch Super Retina XDR display.',
    price: 1199.99,
    category: 'electronics',
    stock: 50,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1678652122309-646f56b0d3aa?w=500',
      'https://images.unsplash.com/photo-1678911820864-e5ec047d3f90?w=500',
    ],
  },
  {
    name: 'Samsung Galaxy S24 Ultra',
    description: 'Premium Samsung smartphone with S Pen, 200MP camera, and Galaxy AI features. Stunning 6.8-inch AMOLED display.',
    price: 1299.99,
    category: 'electronics',
    stock: 35,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=500',
    ],
  },
  {
    name: 'MacBook Pro 16" M3',
    description: 'Powerful Apple laptop with M3 chip, 16GB RAM, 512GB SSD. Perfect for professionals and creators.',
    price: 2499.99,
    category: 'electronics',
    stock: 25,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500',
    ],
  },
  {
    name: 'Sony WH-1000XM5 Headphones',
    description: 'Industry-leading noise canceling wireless headphones with premium sound quality and 30-hour battery life.',
    price: 399.99,
    category: 'electronics',
    stock: 100,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500',
    ],
  },
  {
    name: 'Nike Air Max 270',
    description: 'Comfortable running shoes with Air Max cushioning and breathable mesh upper. Available in multiple colors.',
    price: 150.00,
    category: 'clothing',
    stock: 75,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
    ],
  },
  {
    name: 'Levi\'s 501 Original Jeans',
    description: 'Classic straight-fit jeans with button fly. The original jean since 1873. 100% cotton denim.',
    price: 89.99,
    category: 'clothing',
    stock: 120,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1542272454315-d3e8c5f2c535?w=500',
    ],
  },
  {
    name: 'The Design of Everyday Things',
    description: 'Classic book by Don Norman about user-centered design. Essential reading for designers and product managers.',
    price: 18.99,
    category: 'books',
    stock: 60,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500',
    ],
  },
  {
    name: 'Clean Code by Robert Martin',
    description: 'A handbook of agile software craftsmanship. Learn to write clean, maintainable code.',
    price: 42.99,
    category: 'books',
    stock: 45,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=500',
    ],
  },
  {
    name: 'KitchenAid Stand Mixer',
    description: 'Professional 5-quart stand mixer with 10 speeds. Perfect for baking and cooking enthusiasts.',
    price: 379.99,
    category: 'home',
    stock: 30,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=500',
    ],
  },
  {
    name: 'Dyson V15 Vacuum Cleaner',
    description: 'Cordless vacuum with laser detection and advanced filtration. Captures 99.99% of particles.',
    price: 649.99,
    category: 'home',
    stock: 20,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=500',
    ],
  },
  {
    name: 'Yoga Mat Premium',
    description: 'Extra thick 6mm yoga mat with non-slip surface. Includes carrying strap. Perfect for yoga and fitness.',
    price: 34.99,
    category: 'sports',
    stock: 150,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500',
    ],
  },
  {
    name: 'Dumbbell Set 20kg',
    description: 'Adjustable dumbbell set with multiple weight plates. Great for home workouts.',
    price: 89.99,
    category: 'sports',
    stock: 40,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=500',
    ],
  },
  {
    name: 'LEGO Star Wars Millennium Falcon',
    description: 'Iconic Star Wars building set with 1,351 pieces. Includes minifigures of Han Solo, Chewbacca, and more.',
    price: 159.99,
    category: 'toys',
    stock: 55,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=500',
    ],
  },
  {
    name: 'Nintendo Switch OLED',
    description: 'Gaming console with vibrant 7-inch OLED screen. Play at home or on the go.',
    price: 349.99,
    category: 'toys',
    stock: 65,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=500',
    ],
  },
  {
    name: 'Organic Coffee Beans 1kg',
    description: 'Premium organic Arabica coffee beans. Medium roast with notes of chocolate and caramel.',
    price: 24.99,
    category: 'food',
    stock: 200,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500',
    ],
  },
  {
    name: 'Green Tea Collection',
    description: 'Assorted premium green teas from around the world. Contains 40 tea bags in 8 varieties.',
    price: 19.99,
    category: 'food',
    stock: 180,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=500',
    ],
  },
  {
    name: 'Neutrogena Hydro Boost Serum',
    description: 'Lightweight hydrating serum with hyaluronic acid. Suitable for all skin types.',
    price: 29.99,
    category: 'beauty',
    stock: 95,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500',
    ],
  },
  {
    name: 'The Ordinary Niacinamide Serum',
    description: 'High-strength vitamin and zinc serum to reduce blemishes and congestion.',
    price: 12.99,
    category: 'beauty',
    stock: 140,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=500',
    ],
  },
  {
    name: 'Wireless Keyboard & Mouse Combo',
    description: 'Ergonomic wireless keyboard and mouse set with quiet keys. 2.4GHz connection.',
    price: 59.99,
    category: 'electronics',
    stock: 80,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500',
    ],
  },
  {
    name: 'USB-C Hub 7-in-1',
    description: 'Multiport adapter with HDMI, USB 3.0, SD card reader, and power delivery.',
    price: 45.99,
    category: 'electronics',
    stock: 110,
    isActive: true,
    images: [
      'https://images.unsplash.com/photo-1625948515291-69613efd103f?w=500',
    ],
  },
];

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    // Get or create admin user
    let adminUser = await User.findOne({ role: 'admin' });

    if (!adminUser) {
      console.log('👤 Creating admin user...');
      const hashedPassword = await hashPassword('Admin@123');
      adminUser = await User.create({
        email: 'admin@shopping.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isEmailVerified: true,
        passwordChangedAt: new Date(),
        passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
      console.log('✅ Admin user created (email: admin@shopping.com, password: Admin@123)');
    } else {
      console.log('✅ Using existing admin user');
    }

    // Clear existing products
    await Product.deleteMany({});
    console.log('🗑️  Cleared existing products');

    // Add createdBy to all products and insert one by one to trigger pre-save hooks
    console.log('📝 Creating products...');
    const createdProducts = [];

    for (const product of sampleProducts) {
      const newProduct = await Product.create({
        ...product,
        createdBy: adminUser._id,
      });
      createdProducts.push(newProduct);
    }

    console.log(`✅ Added ${createdProducts.length} sample products`);

    console.log('\n📊 Product Summary:');
    const categories = {};
    createdProducts.forEach((product) => {
      categories[product.category] = (categories[product.category] || 0) + 1;
    });

    Object.entries(categories).forEach(([category, count]) => {
      console.log(`   - ${category}: ${count} products`);
    });

    console.log('\n✨ Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
