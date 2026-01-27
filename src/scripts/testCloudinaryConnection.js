import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from .env in backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

console.log('--- Testing Cloudinary Connection ---');
console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME || 'MISSING');
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '******' + process.env.CLOUDINARY_API_KEY.slice(-4) : 'MISSING');
console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? '******' : 'MISSING');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function testConnection() {
    try {
        console.log('\nAttempting to fetch resource info from Cloudinary...');
        const result = await cloudinary.api.ping();
        console.log('✅ Connection Successful!');
        console.log('Response:', result);
    } catch (error) {
        console.error('❌ Connection Failed!');
        console.error('Error:', error.message);
        if (error.http_code === 401) {
            console.error('Hint: Double check your API Key and Secret.');
        } else if (error.http_code === 404) {
            console.error('Hint: Double check your Cloud Name.');
        }
    }
}

testConnection();
