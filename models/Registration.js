const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true, index: true },
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true, index: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ActivityTemplate', index: true },
  name: { type: String, required: true, index: true },
  phone: { type: String, required: true, index: true },
  company: { type: String, required: true, index: true },
  position: { type: String, default: '' },
  email: { type: String, default: '' },
  formData: { type: Object, default: {} },
  city: { type: String, default: '' },
  registerTime: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

registrationSchema.index({ activityId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
