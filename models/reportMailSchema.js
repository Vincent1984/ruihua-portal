const mongoose = require('mongoose');
module.exports = new mongoose.Schema({
    status: { type: String, enum: ['pending', 'sending', 'accepted', 'failed', 'uncertain'], required: true },
    reportSlug: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lockedAt: Date,
    acceptedAt: Date,
    linkExpiresAt: Date,
    messageId: String,
    lastError: String
}, { _id: false });
