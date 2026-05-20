const mongoose = require('mongoose');

const nqocDebateConfigSchema = new mongoose.Schema({
    topic1_status: { type: String, enum: ['not_started', 'in_progress', 'ended'], default: 'in_progress' },
    topic1_proVotes: { type: Number, default: 0 },
    topic1_conVotes: { type: Number, default: 0 },
    
    topic2_status: { type: String, enum: ['not_started', 'in_progress', 'ended'], default: 'in_progress' },
    topic2_proVotes: { type: Number, default: 0 },
    topic2_conVotes: { type: Number, default: 0 },
    
    maxVotesPerDevice: { type: Number, default: 5 }
}, { timestamps: true });

module.exports = mongoose.model('NqocDebateConfig', nqocDebateConfigSchema);
