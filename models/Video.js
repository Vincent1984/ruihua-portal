const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, index: true }, // Legacy
  videoCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'VideoCategory', index: true }], // New tree categories
  slug: { type: String, unique: true, sparse: true },
  slugHistory: [String], // Track old slugs for 301 redirects or audit
  thumbnail: String, // image path
  thumbnailAlt: String, // ALT attribute
  videoUrl: String, // external link or mp4 url
  embedCode: String, // optional embed HTML (e.g., iframe)
  description: String,
  content: String, // Full rich-text content/summary
  speakerName: String, // Legacy
  speakerTitle: String, // Legacy
  speakerAvatar: String, // Legacy
  speakers: [{ 
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' },
    role: { type: String, enum: ['主讲', '辅讲'], default: '主讲' }
  }],
  duration: String, // e.g., "45:20"
  durationSeconds: Number, // Extracted duration in seconds for accurate queries
  tags: [String],
  aiTags: [{ name: String, score: Number, confirmed: { type: Boolean, default: false } }], // AI generated tags
  isRecommended: { type: Boolean, default: false },
  recommendedAt: { type: Date }, // Timestamp when it was set to recommended
  showProductivityAd: { type: Boolean, default: true },
  status: { type: String, enum: ['published', 'draft', 'archived'], default: 'published' },
  publishDate: { type: Date, default: Date.now, index: true },
  views: { type: Number, default: 0 },
  
  // SEO & GEO Optimization Fields
  metaTitle: String,
  metaDescription: String,
  seoKeywords: [String],
  geoSummary: String, // Generative Engine Optimization specific summary
  structuredData: String, // Optional JSON-LD schema
  faqs: [{ question: String, answer: String }], // AI Generated FAQs
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Video', videoSchema);

