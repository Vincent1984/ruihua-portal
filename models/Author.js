const mongoose = require('mongoose');

const authorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatar: String, // URL to image
  desc: String, // Short description (Title/Role)
  detail: String, // Long HTML/Text description
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Author', authorSchema);
