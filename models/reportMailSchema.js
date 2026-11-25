const mongoose = require('mongoose');
module.exports = new mongoose.Schema({
    status: { type: String, enum: ['pending', 'sending', 'accepted', 'failed', 'uncertain', 'cancelled'], required: true },
    template: { type: mongoose.Schema.Types.Mixed, default: undefined },
    batchId: String, historySynced: Boolean, jobId: String, requestKey: String, recipient: String, origin: String, requestedBy: String, requestedById: String, requestedAt: Date, reason: String, reportVersion: String, templateVersion: String,
    reportSlug: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lockedAt: Date,
    acceptedAt: Date,
    linkExpiresAt: Date,
    messageId: String,
    lastError: String
}, { _id: false });
