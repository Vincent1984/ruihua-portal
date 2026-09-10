const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/admin');
const Role = require('../models/Role');
require('dotenv').config();

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/ruihua_cms';
const USERNAME = process.argv[2] || 'ruihua';
const PASSWORD = process.argv[3] || 'Ruihua@2026';

async function main() {
  console.log(`[SetupSuperAdmin] Connecting to MongoDB: ${MONGODB_URL}`);
  await mongoose.connect(MONGODB_URL);
  console.log('[SetupSuperAdmin] MongoDB connected.');

  try {
    // 1. 创建或更新超级管理员角色
    let superAdminRole = await Role.findOne({ name: '超级管理员' });
    if (!superAdminRole) {
      superAdminRole = new Role({
        name: '超级管理员',
        description: '拥有所有权限的超级管理员角色',
        permissions: ['all'], // 'all' 权限表示所有权限
        isActive: true
      });
      await superAdminRole.save();
      console.log('[SetupSuperAdmin] Created super admin role:', superAdminRole._id);
    } else {
      // 确保超级管理员角色有 'all' 权限
      if (!superAdminRole.permissions.includes('all')) {
        superAdminRole.permissions.push('all');
        await superAdminRole.save();
      }
      console.log('[SetupSuperAdmin] Super admin role already exists:', superAdminRole._id);
    }

    // 2. 创建或更新管理员账号
    const hashed = await bcrypt.hash(PASSWORD, 10);
    let admin = await Admin.findOne({ username: USERNAME });

    if (!admin) {
      admin = new Admin({
        username: USERNAME,
        password: hashed,
        name: '超级管理员',
        isActive: true,
        roles: [superAdminRole._id]
      });
      console.log('[SetupSuperAdmin] Created new admin account');
    } else {
      admin.password = hashed;
      admin.isActive = true;
      admin.failedLoginCount = 0;
      admin.lockedUntil = null;

      // 确保管理员有超级管理员角色
      if (!admin.roles.some(r => r.toString() === superAdminRole._id.toString())) {
        admin.roles.push(superAdminRole._id);
      }
      console.log('[SetupSuperAdmin] Updated existing admin account');
    }

    await admin.save();

    console.log('[SetupSuperAdmin] ✓ Success!');
    console.log(`[SetupSuperAdmin]   Username: ${USERNAME}`);
    console.log(`[SetupSuperAdmin]   Password: ${PASSWORD}`);
    console.log(`[SetupSuperAdmin]   Admin ID: ${admin._id}`);
    console.log(`[SetupSuperAdmin]   Role ID: ${superAdminRole._id}`);
    console.log(`[SetupSuperAdmin]   Permissions: ${superAdminRole.permissions.join(', ')}`);

  } finally {
    await mongoose.disconnect();
    console.log('[SetupSuperAdmin] MongoDB disconnected.');
  }
}

main().catch(err => {
  console.error('[SetupSuperAdmin] Failed:', err);
  process.exit(1);
});
