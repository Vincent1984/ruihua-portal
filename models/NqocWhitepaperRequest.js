const mongoose = require('mongoose');

const NqocWhitepaperRequestSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    company: { type: String, required: true },
    position: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NqocWhitepaperRequest', NqocWhitepaperRequestSchema);