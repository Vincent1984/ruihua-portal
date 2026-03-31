const mongoose = require('mongoose');

const activityChannelConfigSchema = new mongoose.Schema({
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
  token: { type: String, required: true, unique: true }
}, { _id: false });

const activitySchema = new mongoose.Schema({
  theme: { type: String, required: true, index: true },
  city: { type: String, required: true, index: true },
  month: { type: String, required: true, index: true },
  eventTime: { type: String, required: true },
  location: { type: String, required: true, index: true },
  content: { type: String, default: '' },
  registrationDeadline: { type: Date, required: true, index: true },
  organizer: { type: String, required: true, index: true },
  organizerContact: { type: String, default: '' },
  templateName: { type: String, required: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ActivityTemplate', index: true },
  activityType: { type: String, enum: ['hr_forum', 'city_salon', 'closed_door'], default: 'hr_forum', index: true },
  styleConfig: {
    heroImage: { type: String, default: '' },
    bgStart: { type: String, default: '#8b5cff' },
    bgEnd: { type: String, default: '#6f42ff' },
    titleColor: { type: String, default: '#ffffff' },
    panelOpacity: { type: Number, default: 0.06 },
    buttonStart: { type: String, default: '#8a54ff' },
    buttonEnd: { type: String, default: '#5a26ff' }
  },
  channels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Channel' }],
  channelConfigs: [activityChannelConfigSchema],
  status: { type: String, enum: ['draft', 'published', 'closed'], default: 'published', index: true }
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);
