const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: String, // 显示名称
  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }], // 关联角色列表
  lastLogin: Date,
  isActive: { type: Boolean, default: true },
  lastPasswordChangedAt: Date,
  failedLoginCount: { type: Number, default: 0 },
  lockedUntil: Date,
  createdBy: String,
  updatedBy: String
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
