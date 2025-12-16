const mongoose = require('mongoose');
const articleSchema = new mongoose.Schema({
  title: String,
  category: String, // 'whitepaper', 'tech', 'ceo', 'industry'
  summary: String,
  content: String,  // 可以是 HTML 内容
  coverImage: String,
  author: String,
  publishDate: { type: Date, default: Date.now },
  views: { type: Number, default: 0 }
});
module.exports = mongoose.model('Article', articleSchema);