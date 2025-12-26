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

// 创建复合索引，确保同一手机号在有效期内只能有一个验证码
verificationCodeSchema.index({ phone: 1, createdAt: 1 }, { unique: true });

module.exports = mongoose.model('VerificationCode', verificationCodeSchema);