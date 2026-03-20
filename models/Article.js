const mongoose = require('mongoose');
const articleSchema = new mongoose.Schema({
  title: String,
  category: String, // 'whitepaper', 'tech', 'ceo', 'industry'
  slug: { type: String, unique: true }, // 添加slug字段，用于伪静态链接
 summary: String, // 现作为 GEO 摘要 (核心内容快读)
  seoDescription: String, // 新增：SEO 专属摘要 (Meta Description)
  content: String,  // 可以是 HTML 内容
  coverImage: String,
  qa: [{ question: String, answer: String, isManualEdited: { type: Boolean, default: false } }], // Q&A 问答对
  author: { // 内嵌作者快照
    name: String, avatar: String, desc: String, detail: String
  },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' }, // Link to Author model
  isRecommended: { type: Boolean, default: false }, // 添加推荐标识字段
  publishDate: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }, // 编辑时间
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 }, // Add likes field
  status: { type: String, enum: ['draft', 'published', 'archived', 'scheduled'], default: 'published' }, // 文章状态
  tags: [String], // 文章标签
  geoScore: { type: Number, default: 0 }, // GEO 综合评分
  geoDimensions: { // GEO 维度详情
    semantic: { type: Number, default: 0 }, // 内容语义完整性
    ai: { type: Number, default: 0 }, // AI可理解性
    structure: { type: Number, default: 0 }, // 结构化数据质量
    other: { type: Number, default: 0 } // 其他维度
  }
});
module.exports = mongoose.model('Article', articleSchema);