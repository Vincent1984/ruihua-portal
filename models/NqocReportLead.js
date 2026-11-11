const mongoose = require('mongoose');

// 新质组织 · 报告领取记录（前台表单写入，后台只读 + 导出）
const nqocReportLeadSchema = new mongoose.Schema({
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
    createdAt: { type: Date, default: Date.now }
});

nqocReportLeadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('NqocReportLead', nqocReportLeadSchema);
