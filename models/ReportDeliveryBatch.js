const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    _id: String, requestedBy: { type: String, required: true }, requestedById: { type: String, default: '' }, reason: String, template: mongoose.Schema.Types.Mixed,
    status: { type: String, enum: ['pending', 'processing', 'completed', 'interrupted'], default: 'pending' }, lockedUntil: Date,
    items: [{ _id: false, id: String, expectedEmail: String, reportSlug: String, reportVersion: String }],
    results: [{ _id: false, id: String, status: String, jobId: String, message: String }]
}, { timestamps: true });
schema.index({ requestedById: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model('ReportDeliveryBatch', schema);
