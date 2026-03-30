const mongoose = require('mongoose');

const fileNameMapSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  numericName: { type: String, required: true, index: true },
  directory: { type: String, required: true },
  ext: { type: String, required: true },
  variant: { type: String, enum: ['main', 'thumb'], required: true },
  hashHex: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FileNameMap', fileNameMapSchema);
