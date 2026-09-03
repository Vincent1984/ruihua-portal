const mongoose = require('mongoose');

// 行业案例模型（对齐设计稿 rh2026.html 中 CASE_DB 结构）
const caseSchema = new mongoose.Schema({
  title: { type: String, required: true },        // 案例标题
  slug: { type: String, unique: true, sparse: true }, // SEO 友好 URL
  industry: String,                                // 行业：制造业 / 教育 / 零售快消 …（对应 CASE_DB.ind）
  client: String,                                  // 客户名称（可选）
  cover: String,                                   // 封面图
  tags: [String],                                  // 标签（规模、职能等）
  background: String,                              // 背景（CASE_DB.bg）
  problems: [String],                              // 问题（CASE_DB.prob）
  goals: [String],                                 // 目标（CASE_DB.goal）
  solutions: [String],                             // 方案（CASE_DB.sol）
  resultTags: [String],                            // 结果标签（CASE_DB.resBody，成对 [标签,说明] 展开）
  stats: [{ label: String, value: String }],       // 数据指标（CASE_DB.stats）
  featured: { type: Boolean, default: false },     // 是否首页精选
  featuredOrder: { type: Number, default: 0 },     // 精选排序
  isOnline: { type: Boolean, default: true },       // 独立上下架，不改变内容状态
  order: { type: Number, default: 0 },             // 列表排序
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'published' },
  seo: {
    title: String,
    description: String,
    keywords: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

caseSchema.pre('save', async function () {
  this.updatedAt = new Date();
});

module.exports = mongoose.model('Case', caseSchema);
