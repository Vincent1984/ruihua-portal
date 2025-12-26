const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    operator: { type: String, required: true }, // 操作人用户名
    action: { type: String, required: true }, // 动作，如 "删除文章"
    method: String, // HTTP方法
    path: String, // 请求路径
    ip: String, // IP地址
    details: Object, // 详情
    status: { type: String, default: 'success' } // 状态
}, { timestamps: true });

module.exports = mongoose.model('OperationLog', logSchema);
