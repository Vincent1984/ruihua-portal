const mongoose = require('mongoose');
const Admin = require('./models/admin');
const Role = require('./models/Role');
const bcrypt = require('bcryptjs');
const axios = require('axios');
require('dotenv').config();

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/ruihua_cms';
const API_URL = 'http://localhost:3000/api';

async function runTests() {
    try {
        // 1. Setup DB Connection
        await mongoose.connect(MONGODB_URL);
        console.log('✅ DB Connected');

        // 2. Create Test User
        const testUser = 'api_tester';
        const testPass = 'Tester@1234';
        
        // Ensure role exists
        let role = await Role.findOne({ code: 'super_admin' });
        if (!role) {
            role = await Role.create({ name: 'Super Admin', code: 'super_admin', permissions: ['all'] });
        }

        const hashedPassword = await bcrypt.hash(testPass, 10);
        await Admin.deleteOne({ username: testUser }); // Clean up old
        const admin = await Admin.create({
            username: testUser,
            password: hashedPassword,
            name: 'API Tester',
            roles: [role._id],
            isActive: true
        });
        console.log('✅ Test User Created');

        // 3. Test Login
        console.log('Testing Login...');
        const loginRes = await axios.post(`${API_URL}/login`, {
            username: testUser,
            password: testPass
        });
        
        if (!loginRes.data.token) throw new Error('No token received');
        const token = loginRes.data.token;
        console.log('✅ Login Successful');

        const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

        // 4. Test APIs
        const apis = [
            { name: 'Dashboard Stats', url: '/dashboard/stats', method: 'get' },
            { name: 'Sidebar Config', url: '/sidebar', method: 'get' },
            { name: 'Articles List', url: '/articles?limit=1', method: 'get' },
            { name: 'Whitepapers', url: '/whitepaper/list?limit=1', method: 'get' },
            { name: 'Roles', url: '/roles', method: 'get' },
            { name: 'Admins', url: '/admins', method: 'get' } // Assuming this exists or similar
        ];

        for (const api of apis) {
            try {
                await axios[api.method](`${API_URL}${api.url}`, authHeaders);
                console.log(`✅ API ${api.name} OK`);
            } catch (e) {
                console.error(`❌ API ${api.name} Failed: ${e.response?.status} - ${e.response?.statusText}`);
            }
        }

        // 5. Cleanup
        await Admin.deleteOne({ _id: admin._id });
        console.log('✅ Cleanup Done');

    } catch (e) {
        console.error('❌ Test Suite Failed:', e.message);
        if(e.response) console.error('Response:', e.response.data);
    } finally {
        await mongoose.disconnect();
    }
}

runTests();
