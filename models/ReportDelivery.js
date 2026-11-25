const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    source: { type: String, required: true }, leadId: { type: String, required: true },
    requestKey: String, recipient: { type: String, required: true },
    reportSlug: String, reportTitle: String, reportVersion: String, templateVersion: String,
    origin: { type: String, enum: ['auto', 'manual', 'batch', 'legacy'], required: true },
    batchId: String, requestedBy: String, requestedById: String, requestedAt: Date, reason: String, imported: Boolean,
    status: { type: String, enum: ['pending', 'sending', 'accepted', 'failed', 'uncertain', 'cancelled'], required: true },
    attemptCount: { type: Number, default: 0 }, acceptedAt: Date, linkExpiresAt: Date,
    messageId: String, lastError: String, purgeAt: { type: Date, default: null },
    attempts: [{ _id: false, number: Number, startedAt: Date, endedAt: Date, status: String, error: String, messageId: String }]
}, { timestamps: true });
schema.index({ source: 1, leadId: 1, createdAt: -1 });
schema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ source: 1, leadId: 1, requestKey: 1 }, { unique: true, partialFilterExpression: { requestKey: { $type: 'string' } } });
module.exports = mongoose.model('ReportDelivery', schema);
