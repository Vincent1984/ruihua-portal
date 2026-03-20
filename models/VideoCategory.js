const mongoose = require('mongoose');

const videoCategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoCategory', default: null },
  level: { type: Number, default: 1 }, // 1: 主分类, 2: 子分类, 3: 标签
  description: String,
  icon: String,
  order: { type: Number, default: 0 },
  seoTitle: String,
  seoDescription: String,
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VideoCategory', videoCategorySchema);
