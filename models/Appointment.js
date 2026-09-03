const mongoose = require('mongoose');
const appointmentSchema = new mongoose.Schema({
  externalId: { type: String, unique: true, sparse: true, index: true },
  name: String,
  phone: String,
  company: String,
  department: String, // 部门：市场/销售/HR/财务/客服/产品/研发/其他
  title: String,
  problem: String,
  email: { type: String, trim: true },
  source: String, // 来源页面
  intents: [String],
  leadPage: { type: String, trim: true },
  trigger: { type: String, trim: true },
  device: { type: String, trim: true },
  trail: [{ h: String, t: String, d: String, hit: Boolean }],
  kb: [String],
  talk: [{ r: String, t: String, rag: [String], src: [mongoose.Schema.Types.Mixed] }],
  notes: [{ ts: { type: Date, default: Date.now }, by: String, txt: String }],
  remarks: String,
  landing_page: { type: String, trim: true },
  referrer: { type: String, trim: true },
  external_source: { type: String, trim: true, index: true }, // 外部渠道来源（utm_source 或 referrer 域名）
  channel: { type: String, default: 'direct', trim: true, index: true },
  // UTM参数字段
  utm_source: { type: String, trim: true, index: true },     // 来源网站
  utm_medium: { type: String, trim: true, index: true },     // 媒介
  utm_campaign: { type: String, trim: true, index: true },   // 活动
  utm_term: { type: String, trim: true },       // 关键词
  utm_content: { type: String, trim: true },    // 内容
  status: {
    type: String,
    enum: ['new', 'processed', 'archived', 'contacted', 'opp', 'won', 'closed', 'completed'],
    default: 'new'
  },
  createdAt: { type: Date, default: Date.now }
});

// Add compound index for analytics performance
appointmentSchema.index({ utm_source: 1, createdAt: -1 });
// Add index for sorting
appointmentSchema.index({ createdAt: -1 });
module.exports = mongoose.model('Appointment', appointmentSchema);