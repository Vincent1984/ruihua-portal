const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    name: { type: String, required: true },
    subject: { type: String, required: true },
    preheader: String,
    body: { type: String, required: true },
    button: { type: String, required: true },
    signature: String,
    replyTo: String,
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    createdBy: String
}, { timestamps: true });
module.exports = mongoose.model('ReportMailTemplate', schema);
