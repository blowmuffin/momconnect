const mongoose = require('mongoose');

const userInteractionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true
  },
  interactionType: {
    type: String,
    enum: ['view', 'like', 'comment', 'save', 'share'],
    required: true
  },
  weight: {
    type: Number,
    default: 1,
    // Weights: view=1, like=3, comment=5, save=4, share=6
  },
  duration: {
    type: Number,
    default: 0,
    // Time spent viewing in seconds (for view interactions)
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index for efficient queries
userInteractionSchema.index({ user: 1, post: 1, interactionType: 1 });
userInteractionSchema.index({ post: 1, createdAt: -1 });
// Author-affinity index: find how much a user engages with a specific post author
userInteractionSchema.index({ user: 1, interactionType: 1, createdAt: -1 });

// Static method to record an interaction
userInteractionSchema.statics.recordInteraction = async function (userId, postId, type, duration = 0) {
  const weights = {
    view: 1,
    like: 3,
    comment: 5,
    save: 4,
    share: 6
  };

  try {
    const updateData = {
      user: userId,
      post: postId,
      interactionType: type,
      weight: weights[type] || 1,
      createdAt: new Date()
    };
    if (type === 'view' && duration > 0) {
      updateData.duration = duration;
    }

    await this.findOneAndUpdate(
      { user: userId, post: postId, interactionType: type },
      updateData,
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Error recording interaction:', error);
  }
};

module.exports = mongoose.model('UserInteraction', userInteractionSchema);

