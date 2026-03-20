const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  description: { type: String }, // Optional description for the question
  answer: { type: String, required: true },
  order: { type: Number, default: 0 },
  status: { type: String, enum: ['published', 'draft', 'archived'], default: 'published' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Faq', faqSchema);
