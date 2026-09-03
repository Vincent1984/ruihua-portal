const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema({
  name: String,
  role: String,
  account: String,
  scope: [String],
  channel: String,
  enabled: { type: Boolean, default: true }
}, { _id: true });

const globalConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'website', unique: true },
  tel: String,
  mail: String,
  cities: [String],
  icp: String,
  qr: String,
  oldDomain: String,
  newDomain: String,
  logo: { type: String, enum: ['remote', 'local'], default: 'remote' },
  notificationChannels: [String],
  escalationHours: { type: Number, enum: [0, 2, 12, 24], default: 0 },
  dailyDigest: { type: String, enum: ['', '09:00', '18:00', '09:00,18:00'], default: '' },
  fallbackRecipient: { type: mongoose.Schema.Types.ObjectId },
  recipients: [recipientSchema],
  updatedAt: { type: Date, default: Date.now },
  updatedBy: String
});

module.exports = mongoose.model('GlobalConfig', globalConfigSchema);
