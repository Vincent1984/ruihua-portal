const mongoose = require('mongoose');

const NqocWhitepaperRequestSchema = new mongoose.Schema({
    mail: { type: require('./reportMailSchema'), default: undefined },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    company: { type: String, required: true },
    position: { type: String, required: true },
    // 报告页面打开追踪：邮件追踪链接与站内下载入口各记一次（与新报告领取记录同口径）
    reportOpenCount: { type: Number, default: 0 },
    firstReportOpenAt: { type: Date, default: null },
    lastReportOpenAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    // 回收站：deletedAt 为 null 表示正常记录；purgeAt 到达后由 MongoDB TTL 线程物理清除
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: '' },
    purgeAt: { type: Date, default: null }
});

NqocWhitepaperRequestSchema.index({ 'mail.status': 1, 'mail.nextAttemptAt': 1 });

NqocWhitepaperRequestSchema.index({ createdAt: -1 });

NqocWhitepaperRequestSchema.index({ deletedAt: 1, createdAt: -1 });

NqocWhitepaperRequestSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('NqocWhitepaperRequest', NqocWhitepaperRequestSchema);