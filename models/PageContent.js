const mongoose = require('mongoose');

// 静态页内容 CMS 模型（solutions / hcvm / about 等页面内容后台可编辑）
const pageContentSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // 页面标识：solutions / p-training / p-consulting / p-fde / hcvm / about / about-team / contact
  title: String,                                       // 页面标题
  // 分区块内容，结构化存储，前端 SSR 渲染
  sections: [{
    type: { type: String },        // 区块类型标识
    heading: String,               // 区块标题
    body: String,                  // 正文（可含 HTML）
    items: [mongoose.Schema.Types.Mixed], // 列表项（结构灵活）
    media: String                  // 媒体资源
  }],
  seo: {
    title: String,
    description: String,
    keywords: String
  },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: String
});

pageContentSchema.pre('save', async function () {
  this.updatedAt = new Date();
});

module.exports = mongoose.model('PageContent', pageContentSchema);
