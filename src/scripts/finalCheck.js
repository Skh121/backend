import mongoose from 'mongoose';
import 'dotenv/config';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import AuditLog from '../models/AuditLog.js';

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);

    const u = await User.countDocuments({ profileImage: { $regex: /\/uploads\// } });
    const p = await Product.countDocuments({ images: { $regex: /\/uploads\// } });
    const o = await Order.countDocuments({ 'items.image': { $regex: /\/uploads\// } });
    const a = await AuditLog.countDocuments({
        $or: [
            { 'details.image': { $regex: /\/uploads\// } },
            { 'details.images': { $regex: /\/uploads\// } },
            { 'details.profileImage': { $regex: /\/uploads\// } }
        ]
    });

    console.log(`Remaining broken links:`);
    console.log(`Users: ${u}`);
    console.log(`Products: ${p}`);
    console.log(`Orders: ${o}`);
    console.log(`AuditLogs: ${a}`);

    process.exit(0);
}
check();
