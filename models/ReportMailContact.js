const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    name: String,
    email: { type: String, required: true },
    sourceLabel: { type: String, required: true },
    sourceId: String,
    importKey: String,
    basis: { type: String, required: true },
    createdBy: String,
    mail: { type: require('./reportMailSchema'), default: undefined },
    deletedAt: { type: Date, default: null },
    reportOpenCount: { type: Number, default: 0 },
    firstReportOpenAt: Date,
    lastReportOpenAt: Date
}, { timestamps: true });
schema.index({ email: 1 });
schema.index({ 'mail.status': 1, 'mail.nextAttemptAt': 1 });
schema.index({ importKey: 1, sourceId: 1 }, { unique: true });
module.exports = mongoose.model('ReportMailContact', schema);
