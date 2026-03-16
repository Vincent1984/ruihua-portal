const mongoose = require('mongoose');

const MaturitySubmissionSchema = new mongoose.Schema({
    name: { type: String, required: false },
    phone: { type: String, required: false },
    company: { type: String, required: false },
    score: { type: Number, required: true },
    level: { type: String, required: true },
    answers: { type: Object, required: true }, // Stores { q1: ['A'], q2: ['B'], ... }
    resultDetail: {
        summary: String,
        insight: String,
        currentStatus: String,
        potential: String,
        action: String
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MaturitySubmission', MaturitySubmissionSchema);
