const mongoose = require('mongoose');

const dailyCounterSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  sequence: { type: Number, default: 0 }
});

module.exports = mongoose.model('DailyCounter', dailyCounterSchema);
