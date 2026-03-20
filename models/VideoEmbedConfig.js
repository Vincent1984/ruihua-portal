const mongoose = require('mongoose');

const videoEmbedConfigSchema = new mongoose.Schema({
  videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
  env: { type: String, default: 'prod' },
  embed_url: { type: String, required: true },
  embed_settings: {
    autoplay: { type: Boolean, default: false },
    loop: { type: Boolean, default: false },
    preload: { type: String, default: 'auto' },
    poster: String,
    watermark: String,
    resolutions: [String]
  },
  position: {
    type: String, default: 'top' // top, bottom, custom
  },
  selector: String,
  dimensions: {
    width: { type: String, default: '100%' },
    height: { type: String, default: 'auto' },
    breakpoints: mongoose.Schema.Types.Mixed
  },
  permissions: {
    requireLogin: { type: Boolean, default: false },
    vipOnly: { type: Boolean, default: false },
    freeTrialSeconds: { type: Number, default: 0 },
    allowedRegions: [String],
    refererWhitelist: [String]
  },
  is_embed_enabled: { type: Boolean, default: false },
  gray_percent: { type: Number, default: 100 },
  version: { type: Number, default: 1 },
  updatedBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

videoEmbedConfigSchema.index({ videoId: 1, env: 1 });

const videoEmbedHistorySchema = new mongoose.Schema({
  configId: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoEmbedConfig' },
  configData: mongoose.Schema.Types.Mixed,
  version: Number,
  updatedBy: String,
  createdAt: { type: Date, default: Date.now }
});

const VideoEmbedConfig = mongoose.model('VideoEmbedConfig', videoEmbedConfigSchema);
const VideoEmbedHistory = mongoose.model('VideoEmbedHistory', videoEmbedHistorySchema);

module.exports = { VideoEmbedConfig, VideoEmbedHistory };