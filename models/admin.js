const mongoose = require('mongoose');
const adminSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String // 需加密存储
});
module.exports = mongoose.model('Admin', adminSchema);