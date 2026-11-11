const mongoose = require('mongoose');

// 新质组织 · 值得看见（详情 /nqoc/worth-seeing/<slug>）
const personSchema = new mongoose.Schema({
    name: { type: String, default: '' },    // ≤12
    title: { type: String, default: '' },   // ≤30
    company: { type: String, default: '' }  // ≤30
}, { _id: false });

const nqocVideoSchema = new mongoose.Schema({
    slug: { type: String, unique: true, sparse: true },
    episode: { type: String, unique: true },      // ^E\d{2,3}$
    title: { type: String, default: '' },         // ≤60
    summary: { type: String, default: '' },       // ≤300
    cover: { type: String, default: '' },         // 发布必填
    videoUrl: { type: String, default: '' },      // 发布必填
    duration: { type: String, default: '' },      // mm:ss 或 h:mm:ss
    guests: [personSchema],                       // 发布时至少 1 位
    host: { type: personSchema, default: () => ({ name: '高燕', title: '副总裁、新质组织研究中心主任', company: '瑞华智策' }) },
    publishDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    slugLocked: { type: Boolean, default: false }
}, { timestamps: true });

nqocVideoSchema.index({ status: 1, publishDate: -1 });

module.exports = mongoose.model('NqocVideo', nqocVideoSchema);
