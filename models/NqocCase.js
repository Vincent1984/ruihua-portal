const mongoose = require('mongoose');

// 新质组织 · 案例研究（详情 /nqoc/cases/<slug>；与主站案例管理互不影响）
const nqocCaseSchema = new mongoose.Schema({
    slug: { type: String, unique: true, sparse: true },
    title: { type: String, default: '' },        // ≤60
    summary: { type: String, default: '' },      // ≤140，发布必填
    cover: { type: String, default: '' },        // 发布必填
    coverAlt: { type: String, default: '' },     // ≤60
    body: { type: String, default: '' },         // 富文本 HTML，发布必填
    publishDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    top: { type: Boolean, default: false },      // 仅已发布可置顶
    slugLocked: { type: Boolean, default: false }
}, { timestamps: true });

nqocCaseSchema.index({ status: 1, top: -1, publishDate: -1 });

module.exports = mongoose.model('NqocCase', nqocCaseSchema);
