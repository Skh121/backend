import mongoose from 'mongoose';
import 'dotenv/config';
import Product from '../models/Product.js';

async function listImages() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const products = await Product.find({}).select('name images');
        console.log(`Found ${products.length} products.\n`);

        products.forEach(p => {
            console.log(`Product: ${p.name}`);
            console.log(`Images:`, p.images);
            console.log('---');
        });

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

listImages();
