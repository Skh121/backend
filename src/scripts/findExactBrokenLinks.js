import mongoose from 'mongoose';
import 'dotenv/config';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

async function findExact() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const targets = [
            'product-1769277155290-452020161.jpg',
            'product-1769277300116-87887190.jpg'
        ];

        console.log('Searching for exact filenames...');

        for (const file of targets) {
            console.log(`\nTarget: ${file}`);

            const p = await Product.find({ images: { $regex: file } });
            if (p.length > 0) console.log(`Found in Products:`, p.map(x => x._id));

            const u = await User.find({ profileImage: { $regex: file } });
            if (u.length > 0) console.log(`Found in Users:`, u.map(x => x._id));

            const o = await Order.find({ 'items.image': { $regex: file } });
            if (o.length > 0) console.log(`Found in Orders:`, o.map(x => x._id));
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

findExact();
