const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  sort: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Channel', channelSchema);
