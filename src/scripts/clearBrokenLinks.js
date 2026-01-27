import mongoose from 'mongoose';
import 'dotenv/config';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import AuditLog from '../models/AuditLog.js';

async function clearBrokenLinks() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.\n');

        // 1. Clear User Profile Images
        console.log('--- Cleaning User Profiles ---');
        const userResult = await User.updateMany(
            { profileImage: { $regex: /\/uploads\// } },
            { $set: { profileImage: null } }
        );
        console.log(`Updated ${userResult.modifiedCount} users.\n`);

        // 2. Clear Product Images
        console.log('--- Cleaning Product Images ---');
        // Find products that have at least one local image
        const products = await Product.find({ images: { $elemMatch: { $regex: /\/uploads\// } } });

        let updatedProductCount = 0;
        for (const product of products) {
            // Filter out links that start with /uploads/
            product.images = product.images.filter(img => !img.includes('/uploads/'));
            await product.save();
            updatedProductCount++;
        }
        console.log(`Cleaned local images from ${updatedProductCount} products.\n`);

        // 3. Clear Order Images (Snapshot data)
        console.log('--- Cleaning Order Snapshots ---');
        const orders = await Order.find({ 'items.image': { $regex: /\/uploads\// } });
        let updatedOrderCount = 0;
        for (const order of orders) {
            order.items.forEach(item => {
                if (item.image && item.image.includes('/uploads/')) {
                    item.image = '/placeholder.png'; // Use a generic string to avoid 404 loop
                }
            });
            await order.save();
            updatedOrderCount++;
        }
        console.log(`Cleaned local images from ${updatedOrderCount} orders.\n`);

        // 4. Clear AuditLog references
        console.log('--- Cleaning AuditLogs ---');
        const logs = await AuditLog.find({
            $or: [
                { 'details.image': { $regex: /\/uploads\// } },
                { 'details.images': { $regex: /\/uploads\// } },
                { 'details.profileImage': { $regex: /\/uploads\// } }
            ]
        });

        let updatedLogCount = 0;
        for (const log of logs) {
            if (log.details.image && log.details.image.includes('/uploads/')) log.details.image = '/placeholder.png';
            if (log.details.profileImage && log.details.profileImage.includes('/uploads/')) log.details.profileImage = '/placeholder.png';
            if (log.details.images && Array.isArray(log.details.images)) {
                log.details.images = log.details.images.filter(img => !img.includes('/uploads/'));
            }
            log.markModified('details');
            await log.save();
            updatedLogCount++;
        }
        console.log(`Cleaned ${updatedLogCount} AuditLog entries.\n`);

        console.log('Cleanup complete. All broken local links have been removed.');
        console.log('You can now upload new images safely to Cloudinary.');
        process.exit(0);
    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

clearBrokenLinks();
