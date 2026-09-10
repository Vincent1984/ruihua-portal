const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: 'AI转型',
    index: true
  },
  order: {
    type: Number,
    default: 0,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 更新时自动设置 updatedAt
faqSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

// 添加索引
faqSchema.index({ category: 1, order: 1 });
faqSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('FAQ', faqSchema);
