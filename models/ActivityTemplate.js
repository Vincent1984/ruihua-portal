const mongoose = require('mongoose');

const templateFieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'phone', 'email', 'textarea', 'smsCode', 'select'], default: 'text' },
  required: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  options: [{ type: String }],
  validation: {
    pattern: { type: String, default: '' },
    minLength: { type: Number, default: 0 },
    maxLength: { type: Number, default: 200 }
  },
  sort: { type: Number, default: 0 }
}, { _id: false });

const templateSnapshotSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  snapshot: { type: Object, required: true },
  operator: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const activityTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  code: { type: String, required: true, unique: true },
  activityType: { type: String, enum: ['hr_forum', 'city_salon', 'closed_door'], required: true, index: true },
  sceneDescription: { type: String, default: '' },
  status: { type: String, enum: ['enabled', 'disabled'], default: 'enabled', index: true },
  formSchema: [templateFieldSchema],
  uiConfig: {
    themeName: { type: String, default: '科技紫' },
    colors: {
      bgStart: { type: String, default: '#8b5cff' },
      bgEnd: { type: String, default: '#6f42ff' },
      titleColor: { type: String, default: '#ffffff' },
      buttonStart: { type: String, default: '#8a54ff' },
      buttonEnd: { type: String, default: '#5a26ff' }
    },
    panelOpacity: { type: Number, default: 0.06 },
    backgroundImage: { type: String, default: '' },
    logoImage: { type: String, default: '' },
    pageTitle: { type: String, default: '' },
    activityIntro: { type: String, default: '' },
    noticeText: { type: String, default: '' },
    successRedirect: { type: String, default: '' },
    successMessage: { type: String, default: '报名成功！后续将通过短信/邮件发放参会邀请函。' }
  },
  usageStats: {
    viewed: { type: Number, default: 0 },
    submitted: { type: Number, default: 0 }
  },
  version: { type: Number, default: 1 },
  versions: [templateSnapshotSchema],
  draftData: { type: Object, default: {} },
  createdBy: { type: String, default: '' },
  updatedBy: { type: String, default: '' }
}, { timestamps: true });

activityTemplateSchema.index({ name: 1, activityType: 1 }, { unique: true });

module.exports = mongoose.model('ActivityTemplate', activityTemplateSchema);
