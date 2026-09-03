const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
require('dotenv').config();

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/ruihua_cms';
const USERNAME = process.argv[2] || 'ruihua';
const PASSWORD = process.argv[3] || 'Ruihua@2026';

async function main() {
  console.log(`[ResetAdmin] Connecting to MongoDB: ${MONGODB_URL}`);
  await mongoose.connect(MONGODB_URL);
  console.log('[ResetAdmin] MongoDB connected.');

  try {
    const hashed = await bcrypt.hash(PASSWORD, 10);
    let doc = await Admin.findOne({ username: USERNAME });
    if (!doc) {
      doc = new Admin({ username: USERNAME, password: hashed, name: '超级管理员', isActive: true });
    } else {
      doc.password = hashed;
      doc.isActive = true;
      doc.failedLoginCount = 0;
      doc.lockedUntil = null;
    }
    await doc.save();
    console.log(`[ResetAdmin] Success: ${USERNAME} => ${PASSWORD} (${doc._id})`);
  } finally {
    await mongoose.disconnect();
    console.log('[ResetAdmin] MongoDB disconnected.');
  }
}
main().catch(err => { console.error('[ResetAdmin] Failed:', err); process.exit(1); });
