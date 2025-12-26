const mongoose = require('mongoose');
const appointmentSchema = new mongoose.Schema({
  name: String,
  phone: String,
  company: String,
  title: String,
  problem: String,
  source: String, // 来源页面
  // UTM参数字段
  utm_source: { type: String, index: true },     // 来源网站
  utm_medium: { type: String, index: true },     // 媒介
  utm_campaign: { type: String, index: true },   // 活动
  utm_term: String,       // 关键词
  utm_content: String,    // 内容
  status: { type: String, default: 'new' }, // new, processed, archived
  createdAt: { type: Date, default: Date.now }
});

// Add compound index for analytics performance
appointmentSchema.index({ utm_source: 1, createdAt: -1 });
module.exports = mongoose.model('Appointment', appointmentSchema);