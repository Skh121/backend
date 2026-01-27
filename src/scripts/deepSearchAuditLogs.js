import mongoose from 'mongoose';
import 'dotenv/config';
import AuditLog from '../models/AuditLog.js';

async function searchAudit() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB.\n');

        // Search for any log entry containing '/uploads/' in any string field or details
        console.log('Searching AuditLogs for "/uploads/" references...');

        // We'll use a slow but thorough approach 
        const logs = await AuditLog.find({
            $or: [
                { 'details.image': { $regex: /\/uploads\// } },
                { 'details.images': { $regex: /\/uploads\// } },
                { 'details.profileImage': { $regex: /\/uploads\// } },
                { 'details.path': { $regex: /\/uploads\// } }
            ]
        });

        console.log(`\nFound ${logs.length} AuditLog entries with broken links.`);

        if (logs.length > 0) {
            console.log('Example entries (first 5):');
            logs.slice(0, 5).forEach(l => {
                console.log(`- ID: ${l._id}, Action: ${l.action}, Category: ${l.category}`);
                console.log(`  Details:`, JSON.stringify(l.details));
            });
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

searchAudit();
