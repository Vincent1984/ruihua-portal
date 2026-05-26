const mongoose = require('mongoose');

const surveyTrackingLogSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, index: true },
    channel: { type: String, index: true },
    deviceType: { type: String }, // 'mobile' | 'pc'
    eventType: { type: String, required: true }, // 'page_view', 'step_enter', 'step_leave', 'page_leave', 'submit_success'
    stepIndex: { type: Number }, // 0, 1, 2, 3
    durationMs: { type: Number }, // 停留耗时
    errorField: { type: String }, // 验证报错字段
    createdAt: { type: Date, default: Date.now, expires: 90 * 24 * 60 * 60 } // 自动清理90天前的数据
});

module.exports = mongoose.model('SurveyTrackingLog', surveyTrackingLogSchema);
