const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // 角色名称，如 "超级管理员"
    code: { type: String, unique: true }, // 角色代码，不再必填，由系统生成
    description: String,
    permissions: [{ type: String }], // 权限列表，如 ['article:list', 'article:create']
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: String,
    updatedBy: String
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
