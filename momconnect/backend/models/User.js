const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false
  },
  avatar: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  children: [{
    name: String,
    age: Number,
    gender: String
  }],
  interests: [String],
  isPrivate: {
    type: Boolean,
    default: false
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  pendingFollowRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  savedPosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  notifications: [{
    type: {
      type: String,
      enum: ['like', 'comment', 'follow', 'follow_request', 'message', 'group']
    },
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post'
    },
    message: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  passwordResetToken: String,
  passwordResetExpires: Date,

  // Emergency contact for crisis auto-calling
  emergencyContact: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },         // E.164 format: +919876543210
    relationship: { type: String, default: '' },   // partner, parent, friend, doctor
    autoCallEnabled: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

// Hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Indexes
userSchema.index({ email: 1 });

module.exports = mongoose.model('User', userSchema);