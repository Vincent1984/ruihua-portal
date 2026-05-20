const mongoose = require('mongoose');

const nqocAwardApplicationSchema = new mongoose.Schema({
    orgName: {
        type: String,
        required: true,
        trim: true
    },
    contactName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    awardCategory: {
        type: String,
        required: true
    },
    fileUrl: {
        type: String,
        default: ''
    },
    channel: {
        type: String,
        default: 'organic'
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'approved', 'rejected'],
        default: 'pending'
    },
    showOnFrontend: {
        type: Boolean,
        default: false
    },
    voteCount: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('NqocAwardApplication', nqocAwardApplicationSchema);