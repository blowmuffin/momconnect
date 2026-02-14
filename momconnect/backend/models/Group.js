const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 1000,
    default: ''
  },
  image: { type: String, default: '' },
  category: {
    type: String,
    enum: ['newborn', 'toddler', 'school-age', 'teens', 'single-moms', 'working-moms', 'stay-at-home', 'health', 'recipes', 'crafts', 'support', 'local', 'general'],
    default: 'general'
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['member', 'moderator', 'admin'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  isPrivate: { type: Boolean, default: false },
  rules: [String],
  pendingRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Indexes
groupSchema.index({ 'members.user': 1 });
groupSchema.index({ category: 1 });

module.exports = mongoose.model('Group', groupSchema);