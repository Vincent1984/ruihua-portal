#!/usr/bin/env node
/**
 * 登录问题诊断脚本
 * 用法: node scripts/diagnose-login.js
 */

const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/ruihua_cms';

async function diagnose() {
  console.log('='.repeat(60));
  console.log('🔍 瑞华智策后台登录诊断工具');
  console.log('='.repeat(60));
  console.log('');

  try {
    console.log('1️⃣  连接数据库...');
    console.log(`   数据库地址: ${MONGODB_URL}`);
    await mongoose.connect(MONGODB_URL);
    console.log('   ✅ 数据库连接成功\n');

    console.log('2️⃣  检查管理员账号...');
    const Role = require('../models/Role');
    const admins = await Admin.find({}).populate('roles').lean();

    if (admins.length === 0) {
      console.log('   ❌ 数据库中没有管理员账号！');
      console.log('   💡 解决方案: 运行 node scripts/setup-superadmin.js\n');
      return;
    }

    console.log(`   找到 ${admins.length} 个管理员账号:\n`);

    for (const admin of admins) {
      console.log(`   账号: ${admin.username}`);
      console.log(`   └─ 显示名: ${admin.name || '未设置'}`);
      console.log(`   └─ 激活状态: ${admin.isActive ? '✅ 已激活' : '❌ 已禁用'}`);

      // 检查密码格式
      if (admin.password.startsWith('$')) {
        console.log(`   └─ 密码: ✅ 已加密 (bcrypt)`);
      } else {
        console.log(`   └─ 密码: ❌ 明文密码（已不支持，需要重置）`);
      }

      // 检查角色和权限
      if (admin.roles && admin.roles.length > 0) {
        console.log(`   └─ 角色: ${admin.roles.map(r => r.name || r).join(', ')}`);
        const allPerms = new Set();
        admin.roles.forEach(role => {
          if (role.permissions && Array.isArray(role.permissions)) {
            role.permissions.forEach(p => allPerms.add(p));
          }
        });
        if (allPerms.size > 0) {
          if (allPerms.has('all')) {
            console.log(`   └─ 权限: ✅ 超级管理员（all 权限）`);
          } else {
            console.log(`   └─ 权限: ${Array.from(allPerms).join(', ')}`);
          }
        } else {
          console.log(`   └─ 权限: ⚠️  角色未配置权限`);
        }
      } else {
        console.log(`   └─ 角色: ❌ 未分配角色`);
        console.log(`   └─ 权限: ❌ 无权限（无法访问后台）`);
        console.log(`   └─ 💡 解决方案: 运行 node scripts/setup-superadmin.js ${admin.username}`);
      }

      // 检查最后登录
      if (admin.lastLogin) {
        console.log(`   └─ 最后登录: ${new Date(admin.lastLogin).toLocaleString('zh-CN')}`);
      } else {
        console.log(`   └─ 最后登录: 从未登录`);
      }

      // 检查账号锁定
      if (admin.lockedUntil && new Date(admin.lockedUntil) > new Date()) {
        console.log(`   └─ 🔒 账号已锁定，解锁时间: ${new Date(admin.lockedUntil).toLocaleString('zh-CN')}`);
      }

      console.log('');
    }

    console.log('3️⃣  测试密码验证...');
    const testUsername = process.env.ADMIN_USERNAME || 'ruihua';
    const testPassword = process.env.ADMIN_PASSWORD || 'Ruihua@2026';

    console.log(`   测试账号: ${testUsername}`);
    console.log(`   测试密码: ${testPassword}\n`);

    const testAdmin = admins.find(a => a.username === testUsername);
    if (!testAdmin) {
      console.log(`   ⚠️  账号 "${testUsername}" 不存在`);
      console.log(`   💡 可用账号: ${admins.map(a => a.username).join(', ')}\n`);
    } else {
      if (!testAdmin.isActive) {
        console.log(`   ❌ 账号 "${testUsername}" 已被禁用\n`);
      } else if (!testAdmin.password.startsWith('$')) {
        console.log(`   ❌ 账号 "${testUsername}" 使用明文密码，已不支持\n`);
        console.log(`   💡 解决方案: node scripts/reset-admin.js ${testUsername} ${testPassword}\n`);
      } else {
        const isMatch = await bcrypt.compare(testPassword, testAdmin.password);
        if (isMatch) {
          console.log(`   ✅ 密码验证通过！\n`);
        } else {
          console.log(`   ❌ 密码错误\n`);
          console.log(`   💡 解决方案: node scripts/reset-admin.js ${testUsername} 你的新密码\n`);
        }
      }
    }

    console.log('4️⃣  环境配置检查...');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   PORT: ${process.env.PORT || 3000}`);
    console.log(`   SECRET_KEY: ${process.env.SECRET_KEY ? '已配置' : '❌ 未配置'}\n`);

    console.log('5️⃣  Cookie 配置检查...');
    console.log(`   HttpOnly: true`);
    console.log(`   SameSite: lax`);
    console.log(`   Secure: ${process.env.NODE_ENV === 'production' ? 'true (生产环境)' : 'false (开发环境)'}`);
    console.log('');

    console.log('='.repeat(60));
    console.log('📋 诊断完成');
    console.log('='.repeat(60));
    console.log('');
    console.log('常见问题解决方案:');
    console.log('');
    console.log('1. 如果账号没有角色或权限（登录后403错误）');
    console.log('   运行: node scripts/setup-superadmin.js');
    console.log('');
    console.log('2. 如果提示"密码安全升级"或"明文密码"');
    console.log('   运行: node scripts/setup-superadmin.js');
    console.log('');
    console.log('3. 如果密码错误');
    console.log('   运行: node scripts/setup-superadmin.js 用户名 新密码');
    console.log('');
    console.log('4. 如果登录后跳回登录页');
    console.log('   - 检查浏览器是否禁用了 Cookie');
    console.log('   - 尝试清除浏览器缓存和 Cookie');
    console.log('   - 使用无痕模式测试');
    console.log('   - 检查服务器日志中的错误信息');
    console.log('');

  } catch (error) {
    console.error('❌ 诊断失败:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.log('');
      console.log('💡 MongoDB 未运行！请先启动 MongoDB:');
      console.log('   ./.mongodb/mongodb-macos-aarch64-7.0.14/bin/mongod \\');
      console.log('     --dbpath ./.mongodb/data \\');
      console.log('     --logpath ./.mongodb/log/mongod.log \\');
      console.log('     --fork \\');
      console.log('     --bind_ip 127.0.0.1');
      console.log('');
    }
  } finally {
    await mongoose.disconnect();
    console.log('数据库连接已关闭');
  }
}

diagnose().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
