const mongoose = require('mongoose');
const articleSchema = new mongoose.Schema({
  title: String,
  category: String, // 'whitepaper', 'tech', 'ceo', 'industry'
  slug: { type: String, unique: true }, // 添加slug字段，用于伪静态链接
  summary: String,
  content: String,  // 可以是 HTML 内容
  coverImage: String,
  author: { name: String, avatar: String, desc: String, detail: String }, // 修改为对象结构，与server.js一致
  isRecommended: { type: Boolean, default: false }, // 添加推荐标识字段
  publishDate: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }, // 编辑时间
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 }, // Add likes field
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'published' }, // 文章状态
  tags: [String] // 文章标签
});
module.exports = mongoose.model('Article', articleSchema);