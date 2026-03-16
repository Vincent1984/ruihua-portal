const mongoose = require('mongoose');

const EfficiencySubmissionSchema = new mongoose.Schema({
    // Enterprise Info
    company: { type: String, required: true },
    industry: { type: String, required: false },
    employeeCount: { type: String, required: false },

    // Financial Data
    revenue: { type: String, required: false },
    grossProfit: { type: String, required: false },
    netProfit: { type: String, required: false },
    hrCost: { type: String, required: false },
    totalCost: { type: String, required: false },

    // Contact Info
    name: { type: String, required: true },
    position: { type: String, required: false },
    phone: { type: String, required: true },
    email: { type: String, required: false },

    // Survey Answers
    answers: {
        // Architecture (A1-A6)
        A1: { type: String },
        A2: { type: String },
        A3: { type: String },
        A4: { type: String },
        A5: { type: String },
        A6: { type: String },
        // Capability (C1-C6)
        C1: { type: String },
        C2: { type: String },
        C3: { type: String },
        C4: { type: String },
        C5: { type: String },
        C6: { type: String },
        // Energy (E1-E6)
        E1: { type: String },
        E2: { type: String },
        E3: { type: String },
        E4: { type: String },
        E5: { type: String },
        E6: { type: String }
    },

    // Detailed Answers (for audit/export)
    detailedAnswers: [{
        questionId: String,
        questionText: String,
        selectedOption: String,
        optionText: String,
        score: Number
    }],

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EfficiencySubmission', EfficiencySubmissionSchema);
