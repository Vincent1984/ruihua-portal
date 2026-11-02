const mongoose = require('mongoose');

// AI 应用需求问卷（/rh-ai-demand-survey 页面提交）
// 前端提交的答题字段均为字符串，这里统一按 String 存储，避免数字/多选混用导致类型转换失败。
const aiDemandSurveySchema = new mongoose.Schema({
  submission_id: { type: String, unique: true, sparse: true, index: true },

  dept: String,
  title: String,
  contact: String,

  q1: String,
  q2: String,
  q3: String,
  q3_other: String,
  q4: String,
  q5_count: String,
  q5_minutes: String,
  q5_people: String,
  q5_hours: String,
  q6: String,
  q6_other: String,
  q7: String,
  q8: String,
  q9: String,
  q9_other: String,
  q10: String,
  attachment_name: String,

  page: String,
  source: String,
  submitted_at: String,
  submitted_at_cn: String,

  ip: String,
  userAgent: String,

  // 钉钉 AI 表格同步状态，同步失败不影响后台存档
  dingtalk_synced: { type: Boolean, default: false },
  dingtalk_error: String
}, { timestamps: true, collection: 'ai_demand_surveys' });

module.exports = mongoose.model('AiDemandSurvey', aiDemandSurveySchema);
