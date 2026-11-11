const mongoose = require('mongoose');

// 新质组织首页 Banner（最多 3 张，至少 1 张展示中）
const nqocBannerSchema = new mongoose.Schema({
    titlePrefix: { type: String, default: '' },        // 标题前段（白色字）≤14
    titleHighlight: { type: String, required: true },  // 标题高亮词（渐变色字）≤14
    highlightOnNewLine: { type: Boolean, default: false },
    titleLine2: { type: String, default: '' },         // 标题第二行 ≤14
    desc: { type: String, default: '' },               // ≤70
    primaryText: { type: String, required: true },     // 主按钮文字 ≤8
    primaryAction: { type: String, enum: ['link', 'report'], default: 'link' },
    primaryUrl: { type: String, default: '' },         // link 时必填，report 时存空串
    secondaryText: { type: String, default: '' },      // ≤8
    secondaryUrl: { type: String, default: '' },
    image: { type: String, default: '' },              // 右侧配图（必填，服务端校验）
    imageAlt: { type: String, default: '' },           // ≤60
    stats: [{ _id: false, value: { type: String, default: '' }, label: { type: String, default: '' } }], // 0-3 项
    isOnline: { type: Boolean, default: true },
    sort: { type: Number, default: 1 }
}, { timestamps: true });

nqocBannerSchema.index({ isOnline: 1, sort: 1 });

module.exports = mongoose.model('NqocBanner', nqocBannerSchema);
