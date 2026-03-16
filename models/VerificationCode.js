const mongoose = require('mongoose');

const verificationCodeSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        index: true
    },
    code: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 180 // 3分钟后自动删除
    },
    used: {
        type: Boolean,
        default: false
    }
});

// 移除 unique 约束，允许同一手机号在不同时间生成验证码
// 如果需要限制频率，已经在业务逻辑中通过 createdAt 判断了
verificationCodeSchema.index({ phone: 1, createdAt: -1 });

module.exports = mongoose.model('VerificationCode', verificationCodeSchema);