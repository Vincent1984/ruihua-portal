const mongoose = require('mongoose');

// 新质组织 · 新质观点（列表 / 详情 /nqoc/insights/<slug>）
const nqocInsightSchema = new mongoose.Schema({
    slug: { type: String, unique: true, sparse: true },
    title: { type: String, default: '' },        // ≤60
    summary: { type: String, default: '' },      // ≤140，发布必填
    cover: { type: String, default: '' },        // 发布必填
    coverAlt: { type: String, default: '' },     // ≤60
    tags: [String],                              // ≤3 个，每个 ≤8 字
    author: { type: String, default: '' },       // ≤30
    source: { type: String, default: '' },       // ≤30
    credits: { type: String, default: '' },      // ≤80
    body: { type: String, default: '' },         // 富文本 HTML，发布必填
    publishDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    top: { type: Boolean, default: false },      // 仅已发布可置顶
    slugLocked: { type: Boolean, default: false } // 首次发布后 slug 不可改
}, { timestamps: true });

nqocInsightSchema.index({ status: 1, top: -1, publishDate: -1 });

module.exports = mongoose.model('NqocInsight', nqocInsightSchema);
