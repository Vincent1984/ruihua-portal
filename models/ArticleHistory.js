const mongoose = require('mongoose');

const articleHistorySchema = new mongoose.Schema({
  articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true },
  title: String,
  content: String,
  summary: String,
  coverImage: String,
  tags: [String],
  status: String,
  editor: { type: String, required: true }, // Username of the editor
  version: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ArticleHistory', articleHistorySchema);
