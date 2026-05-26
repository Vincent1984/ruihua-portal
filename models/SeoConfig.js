const mongoose = require('mongoose');

const seoConfigSchema = new mongoose.Schema({
    pagePath: {
        type: String,
        required: true,
        unique: true,
        description: 'The path of the page, e.g., /index.html or /about.html'
    },
    title: {
        type: String,
        default: ''
    },
    keywords: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        default: ''
    }
}, { timestamps: true });

module.exports = mongoose.model('SeoConfig', seoConfigSchema);
