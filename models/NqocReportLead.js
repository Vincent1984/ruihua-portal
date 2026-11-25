const mongoose = require('mongoose');

// 新质组织 · 报告领取记录（前台表单写入，后台只读 + 导出）
const nqocReportLeadSchema = new mongoose.Schema({
    mail: { type: require('./reportMailSchema'), default: undefined },
    name: { type: String, required: true },       // ≤30
    phone: { type: String, required: true },      // ^1[3-9]\d{9}$
    company: { type: String, required: true },    // ≤60
    position: { type: String, required: true },   // ≤40
    email: { type: String, required: true },      // ≤100
    reportSlug: { type: String, default: '' },    // 提交时领取的报告
    reportTitle: { type: String, default: '' },   // 服务端快照
    sourcePage: { type: String, default: '' },    // 只保留 /nqoc 开头，≤200
    downloadCount: { type: Number, default: 0 },  // 报告下载次数（服务端维护，后台暂不展示）
    lastDownloadedAt: { type: Date, default: null }, // 最近一次下载时间
    createdAt: { type: Date, default: Date.now },
    // 回收站：deletedAt 为 null 表示正常记录；purgeAt 到达后由 MongoDB TTL 线程物理清除
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: '' },     // 操作人用户名
    purgeAt: { type: Date, default: null }
});

nqocReportLeadSchema.index({ createdAt: -1 });

nqocReportLeadSchema.index({ 'mail.status': 1, 'mail.nextAttemptAt': 1 });

nqocReportLeadSchema.index({ deletedAt: 1, createdAt: -1 });

// 只对回收站内记录生效（purgeAt 为 null 的文档不会被 TTL 线程处理）
nqocReportLeadSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('NqocReportLead', nqocReportLeadSchema);
