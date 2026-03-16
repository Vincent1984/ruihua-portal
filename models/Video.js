const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, index: true }, // e.g., demo, interview, case, replay
  slug: { type: String, unique: true, sparse: true },
  thumbnail: String, // image path
  videoUrl: String, // external link or mp4 url
  embedCode: String, // optional embed HTML (e.g., iframe)
  description: String,
  content: String, // Full rich-text content/summary
  speakerName: String,
  speakerTitle: String,
  speakerAvatar: String,
  duration: String, // e.g., "45:20"
  tags: [String],
  isRecommended: { type: Boolean, default: false },
  publishDate: { type: Date, default: Date.now, index: true },
  views: { type: Number, default: 0 }
});

module.exports = mongoose.model('Video', videoSchema);

