const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  images: [String],
  category: {
    type: String,
    enum: ['general', 'advice', 'milestone', 'recipe', 'diy', 'health', 'education', 'fun', 'support', 'question'],
    default: 'general'
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  isPrivate: { type: Boolean, default: false },
  tags: [String]
}, {
  timestamps: true
});

// Indexes for common queries
postSchema.index({ createdAt: -1 });
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ group: 1, createdAt: -1 });
postSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);