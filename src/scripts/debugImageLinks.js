import mongoose from 'mongoose';
import 'dotenv/config';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';

async function debugLinks() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB.\n');

        const products = await Product.find({});
        console.log(`Checking ${products.length} products...`);

        let count = 0;
        products.forEach(p => {
            const broken = p.images.filter(img => img.includes('/uploads/'));
            if (broken.length > 0) {
                console.log(`Product ID: ${p._id} has broken links:`, broken);
                count++;
            }
        });

        const users = await User.find({ profileImage: { $regex: /\/uploads\// } });
        console.log(`\nFound ${users.length} users with local image links.`);
        users.forEach(u => {
            console.log(`User ID: ${u._id} has broken link: ${u.profileImage}`);
        });

        const orders = await Order.find({ 'items.image': { $regex: /\/uploads\// } });
        console.log(`\nFound ${orders.length} orders with local image links.`);
        orders.forEach(o => {
            const broken = o.items.filter(i => i.image && i.image.includes('/uploads/')).map(i => i.image);
            console.log(`Order ID: ${o._id} has broken links in items:`, broken);
        });

        console.log(`\nTotal products with issues: ${count}`);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

debugLinks();
