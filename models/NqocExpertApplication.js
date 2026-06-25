const mongoose = require('mongoose');

const nqocExpertApplicationSchema = new mongoose.Schema({
    // 01 姓名
    name: { type: String, required: true, trim: true },
    // 02 活动选择（多选）
    activities: [{
        type: String,
        enum: [
            'speaker',        // 担任研讨会/私董会/论坛等专业活动分享嘉宾
            'video_interview',// 参与《值得看见》栏目录制
            'case_review',    // 参与《中国新质组织研究项目优秀案例》评审
            'standard_making',// 参与《中国新质组织模型标准》制定
            'host_visits',    // 可以接待其他企业到本企业参观、学习和研讨
            'writing',        // 可以接受约稿，撰写与自己研究领域相关的内容
            'general_events'  // 以上内容都无法支持，但愿意以参加相关的专业活动
        ]
    }],
    // 03 常驻地
    location: { type: String, trim: true },
    // 04 职位名称
    position: { type: String, trim: true },
    // 05 工作单位
    company: { type: String, trim: true },
    // 06 电子邮箱
    email: {
        type: String,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, '请填写有效的邮箱地址']
    },
    // 07 个人官方简介（HTML富文本）
    bio: { type: String, trim: true, maxlength: 2000 },
    // 08 研究领域
    researchFields: { type: String, trim: true },
    // 09 个人专业著作
    publications: { type: String, trim: true },
    // 10 课题需求（HTML富文本）
    topicNeeds: { type: String, trim: true },
    // 11 来源/联系人
    referrer: { type: String, trim: true },
    // 12 个人官方照片（URL）
    photoUrl: { type: String },
    // 13 隐私授权
    privacyConsent: { type: Boolean, default: false },
    // 14 其他声明
    otherDeclaration: { type: String, trim: true },
    // 旧字段兼容：原 description 字段保留，内容合并到 bio/topicNeeds 中
    description: { type: String, select: false },
    status: {
        type: String,
        enum: ['pending', 'contacted', 'rejected', 'approved'],
        default: 'pending'
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date }
});

nqocExpertApplicationSchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('NqocExpertApplication', nqocExpertApplicationSchema);
