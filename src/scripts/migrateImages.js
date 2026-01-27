import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Product from '../models/Product.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function migrateImages() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        // 1. Migrate User Profile Images
        console.log('\n--- Migrating User Profile Images ---');
        const users = await User.find({ profileImage: { $regex: /^\/uploads\// } });
        console.log(`Found ${users.length} users with local images.`);

        for (const user of users) {
            const localPath = path.join(__dirname, '../../', user.profileImage); // Adjust path relative to script
            if (fs.existsSync(localPath)) {
                try {
                    console.log(`Uploading ${localPath}...`);
                    const result = await cloudinary.uploader.upload(localPath, {
                        folder: 'shopsecure/profiles',
                        public_id: `profile-${user._id}-${Date.now()}`,
                    });

                    user.profileImage = result.secure_url;
                    await user.save();
                    console.log(`Updated user ${user._id} -> ${result.secure_url}`);
                } catch (err) {
                    console.error(`Failed to upload ${localPath}:`, err.message);
                }
            } else {
                console.warn(`File not found locally: ${localPath}`);
            }
        }

        // 2. Migrate Product Images
        console.log('\n--- Migrating Product Images ---');
        const products = await Product.find({ images: { $elemMatch: { $regex: /^\/uploads\// } } });
        console.log(`Found ${products.length} products with local images.`);

        for (const product of products) {
            let updated = false;
            const newImages = [...product.images];

            for (let i = 0; i < newImages.length; i++) {
                if (newImages[i].startsWith('/uploads/')) {
                    const localPath = path.join(__dirname, '../../', newImages[i]);
                    if (fs.existsSync(localPath)) {
                        try {
                            console.log(`Uploading ${localPath}...`);
                            const result = await cloudinary.uploader.upload(localPath, {
                                folder: 'shopsecure/products',
                                public_id: `product-${product._id}-${i}-${Date.now()}`,
                            });
                            newImages[i] = result.secure_url;
                            updated = true;
                            console.log(`Uploaded image ${i} for product ${product._id}`);
                        } catch (err) {
                            console.error(`Failed to upload ${localPath}:`, err.message);
                        }
                    } else {
                        console.warn(`File not found locally: ${localPath}`);
                    }
                }
            }

            if (updated) {
                product.images = newImages;
                await product.save();
                console.log(`Updated product ${product._id}`);
            }
        }

        console.log('\nMigration complete.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateImages();
