const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/cryptoUtils');

const behaviorSchema = new mongoose.Schema({
    startTime: { type: Date },
    submitTime: { type: Date },
    durationMs: { type: Number },
    userAgent: { type: String },
    ip: { type: String }
}, { _id: false });

const surveySubmissionSchema = new mongoose.Schema({
    topicInterest: {
        type: String,
        required: [true, '请选择您感兴趣的话题']
    },
    participationForm: {
        type: String,
        required: [true, '请选择参与形式']
    },
    wechatId: {
        type: String,
        required: [true, '请填写您的微信号'],
        set: encrypt,
        get: decrypt
    },
    channel: {
        type: String,
        default: 'organic'
    },
    sourceUrl: {
        type: String
    },
    utmParams: {
        utm_source: String,
        utm_medium: String,
        utm_campaign: String,
        utm_term: String,
        utm_content: String
    },
    behavior: behaviorSchema,
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { getters: true }, // Ensure getters are applied when converting to JSON
    toObject: { getters: true }
});

// Create compound index for analytics and query performance
surveySubmissionSchema.index({ channel: 1, createdAt: -1 });

module.exports = mongoose.model('SurveySubmission', surveySubmissionSchema);