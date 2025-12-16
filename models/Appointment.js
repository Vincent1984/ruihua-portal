const mongoose = require('mongoose');
const appointmentSchema = new mongoose.Schema({
  name: String,
  phone: String,
  company: String,
  title: String,
  problem: String,
  source: String, // 来源页面
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Appointment', appointmentSchema);