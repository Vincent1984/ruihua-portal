const mongoose = require('mongoose');

const whitepaperSubmissionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  company: { type: String, required: true },
  position: { type: String },
  email: { type: String, required: true },
  whitepaperName: { type: String, required: true },
  source: { type: String }, // Page URL or specific source
  submittedAt: { type: Date, default: Date.now },
  
  // UTM Tracking
  utm_source: String,
  utm_medium: String,
  utm_campaign: String,
  utm_term: String,
  utm_content: String
});

module.exports = mongoose.model('WhitepaperSubmission', whitepaperSubmissionSchema);
