const mongoose = require('mongoose');

const authorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatar: String, // URL to image
  desc: String, // Short description (Title/Role)
  detail: String, // Long HTML/Text description
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 查询索引：列表排序与按姓名检索
authorSchema.index({ order: 1, createdAt: -1 });
authorSchema.index({ name: 1 });

module.exports = mongoose.model('Author', authorSchema);
