const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const UserInteraction = require('../models/UserInteraction');
const { protect } = require('../middleware/auth');
const { uploadPost } = require('../middleware/upload');

// Create post
router.post('/', protect, uploadPost.array('images', 5), async (req, res) => {
  try {
    const { content, category, tags, isPrivate, groupId } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const images = req.files ? req.files.map(f => f.filename) : [];
    let parsedTags = [];
    if (tags) {
      try { parsedTags = JSON.parse(tags); }
      catch { parsedTags = tags.split(',').map(t => t.trim()).filter(t => t); }
    }

    const post = await Post.create({
      user: req.user._id,
      content: content.trim(),
      images,
      category: category || 'general',
      tags: parsedTags,
      isPrivate: isPrivate === 'true',
      group: groupId || null
    });

    const populatedPost = await Post.findById(post._id).populate('user', 'name avatar');
    res.status(201).json(populatedPost);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get feed posts
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, category } = req.query;
    const currentUser = await User.findById(req.user._id);

    let query = {
      isPrivate: false,
      group: null,
      $or: [{ user: { $in: [...currentUser.following, req.user._id] } }]
    };

    if (category && category !== 'all') query.category = category;

    const posts = await Post.find(query)
      .populate('user', 'name avatar')
      .populate({
        path: 'comments',
        populate: { path: 'user', select: 'name avatar' },
        options: { sort: { createdAt: -1 }, limit: 3 }
      })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Post.countDocuments(query);

    // Fire-and-forget view tracking for feed posts
    if (posts.length > 0) {
      Promise.allSettled(
        posts.map(p => UserInteraction.recordInteraction(req.user._id, p._id, 'view'))
      ).catch(() => { });
    }

    res.json({
      posts,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get explore posts
router.get('/explore', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, category } = req.query;

    let query = { isPrivate: false, group: null };
    if (category && category !== 'all') query.category = category;

    const posts = await Post.find(query)
      .populate('user', 'name avatar')
      .populate({
        path: 'comments',
        populate: { path: 'user', select: 'name avatar' },
        options: { limit: 3 }
      })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Post.countDocuments(query);

    // Fire-and-forget view tracking for explore posts
    if (posts.length > 0) {
      Promise.allSettled(
        posts.map(p => UserInteraction.recordInteraction(req.user._id, p._id, 'view'))
      ).catch(() => { });
    }

    res.json({
      posts,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get personalized recommendations
router.get('/recommendations', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, category } = req.query;
    const currentUser = await User.findById(req.user._id);

    // ─── Pre-compute interaction data ───────────────────────────────
    const userInteractions = await UserInteraction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(200);

    const interactedPostIds = userInteractions.map(i => i.post.toString());
    const interactedPosts = await Post.find({ _id: { $in: interactedPostIds } });

    // Signal 6: Seen-Post Filter — only exclude posts viewed in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const viewedPostIds = userInteractions
      .filter(i => i.interactionType === 'view' && i.createdAt > oneDayAgo)
      .map(i => i.post);

    // Preferred categories from weighted interactions
    const categoryWeights = {};
    interactedPosts.forEach(post => {
      if (post.category) {
        const interaction = userInteractions.find(i => i.post.toString() === post._id.toString());
        const weight = interaction?.weight || 1;
        categoryWeights[post.category] = (categoryWeights[post.category] || 0) + weight;
      }
    });
    const preferredCategories = Object.entries(categoryWeights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    // Signal 3: Tag Similarity — build user's preferred tag set from interacted posts
    const userTagCounts = {};
    interactedPosts.forEach(post => {
      (post.tags || []).forEach(tag => {
        userTagCounts[tag] = (userTagCounts[tag] || 0) + 1;
      });
    });
    const userPreferredTags = Object.entries(userTagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag]) => tag);

    // Signal 1: Author Affinity — engagement count per author
    const authorEngagement = {};
    interactedPosts.forEach(post => {
      const authorId = post.user.toString();
      authorEngagement[authorId] = (authorEngagement[authorId] || 0) + 1;
    });
    // Normalize: top author gets 25 points, linearly scale others
    const maxAuthorCount = Math.max(...Object.values(authorEngagement), 1);
    const authorAffinityMap = {};
    for (const [authorId, count] of Object.entries(authorEngagement)) {
      authorAffinityMap[authorId] = Math.round((count / maxAuthorCount) * 25);
    }

    // Signal 7: Collaborative Filtering — find top-5 similar users
    const userLikedPostIds = userInteractions
      .filter(i => i.interactionType === 'like')
      .map(i => i.post.toString());

    let collaborativePostIds = [];
    if (userLikedPostIds.length > 0) {
      // Find users who liked the same posts (top 5 by overlap)
      const similarUsers = await UserInteraction.aggregate([
        { $match: { post: { $in: userLikedPostIds.map(id => new (require('mongoose').Types.ObjectId)(id)) }, interactionType: 'like', user: { $ne: req.user._id } } },
        { $group: { _id: '$user', overlap: { $sum: 1 } } },
        { $sort: { overlap: -1 } },
        { $limit: 5 }
      ]);
      const similarUserIds = similarUsers.map(u => u._id);

      if (similarUserIds.length > 0) {
        // Get posts those users liked that current user hasn't seen
        const collabInteractions = await UserInteraction.find({
          user: { $in: similarUserIds },
          interactionType: 'like',
          post: { $nin: viewedPostIds }
        }).distinct('post');
        collaborativePostIds = collabInteractions.map(id => id.toString());
      }
    }

    // ─── Build base query ───────────────────────────────────────────
    let matchQuery = {
      $and: [
        { $or: [{ isPrivate: false }, { isPrivate: { $exists: false } }, { isPrivate: null }] },
        { $or: [{ group: null }, { group: { $exists: false } }] },
        // Signal 6: exclude posts viewed in the last 24h only
        ...(viewedPostIds.length > 0 ? [{ _id: { $nin: viewedPostIds } }] : [])
      ]
    };
    if (category && category !== 'all') {
      matchQuery.category = category;
    }

    const now = new Date();
    const dayInMs = 24 * 60 * 60 * 1000;
    const followingIds = currentUser?.following?.map(id => id.toString()) || [];

    // ─── Aggregation pipeline with all scoring signals ──────────────
    const recommendedPosts = await Post.aggregate([
      { $match: matchQuery },
      {
        $addFields: {
          // Base engagement score
          engagementScore: {
            $add: [
              { $size: { $ifNull: ['$likes', []] } },
              { $multiply: [{ $size: { $ifNull: ['$comments', []] } }, 2] }
            ]
          },
          // Age in days
          ageInDays: {
            $divide: [{ $subtract: [now, '$createdAt'] }, dayInMs]
          },
          // Category bonus: +20
          categoryBonus: {
            $cond: [
              { $in: [{ $ifNull: ['$category', ''] }, preferredCategories] },
              20, 0
            ]
          },
          // Following bonus: +15
          followingBonus: {
            $cond: [
              { $in: [{ $toString: '$user' }, followingIds] },
              15, 0
            ]
          },
          // Signal 1: Author Affinity (injected from pre-computed map)
          authorAffinity: {
            $switch: {
              branches: Object.entries(authorAffinityMap).slice(0, 50).map(([authorId, score]) => ({
                case: { $eq: [{ $toString: '$user' }, authorId] },
                then: score
              })),
              default: 0
            }
          },
          // Signal 3: Tag Similarity (Jaccard approximation)
          tagSimilarity: userPreferredTags.length > 0 ? {
            $multiply: [
              15,
              {
                $cond: [
                  { $gt: [{ $size: { $ifNull: ['$tags', []] } }, 0] },
                  {
                    $divide: [
                      { $size: { $setIntersection: [{ $ifNull: ['$tags', []] }, userPreferredTags] } },
                      { $size: { $setUnion: [{ $ifNull: ['$tags', []] }, userPreferredTags] } }
                    ]
                  },
                  0
                ]
              }
            ]
          } : { $literal: 0 },
          // Signal 7: Collaborative boost (+20 if liked by similar users)
          collaborativeBonus: {
            $cond: [
              { $in: [{ $toString: '$_id' }, collaborativePostIds] },
              20, 0
            ]
          }
        }
      },
      {
        $addFields: {
          // Signal 4: Exponential Decay (replaces linear recency)
          // 50 × e^(-ageInDays/14) — half-life ~10 days
          recencyScore: {
            $multiply: [
              50,
              { $exp: { $multiply: [-1, { $divide: ['$ageInDays', 14] }] } }
            ]
          },
          // Signal 2: Engagement Velocity — interactions per hour in first 24h
          // Approximation: if post < 1 day old, use engagement×2; otherwise engagement/age capped at 30
          velocityBonus: {
            $min: [
              30,
              {
                $cond: [
                  { $lte: ['$ageInDays', 1] },
                  { $multiply: ['$engagementScore', 2] },
                  { $divide: ['$engagementScore', { $max: ['$ageInDays', 1] }] }
                ]
              }
            ]
          }
        }
      },
      {
        $addFields: {
          // Combined final score
          finalScore: {
            $add: [
              '$recencyScore',
              { $multiply: ['$engagementScore', 2] },
              '$categoryBonus',
              '$followingBonus',
              '$authorAffinity',
              '$velocityBonus',
              '$tagSimilarity',
              '$collaborativeBonus'
            ]
          }
        }
      },
      { $sort: { finalScore: -1, createdAt: -1 } },
      // Fetch more than needed, so diversity penalty can re-rank
      { $limit: Math.max(parseInt(limit) * 3, 30) }
    ]);

    // Signal 5: Diversity Penalty — penalize consecutive same-author/same-category
    const diversified = [];
    const recentAuthors = [];
    const recentCategories = [];
    for (const post of recommendedPosts) {
      let penalty = 0;
      const authorStr = post.user.toString();
      const cat = post.category || '';
      if (recentAuthors.slice(-2).includes(authorStr)) penalty += 10;
      if (recentCategories.slice(-2).includes(cat)) penalty += 5;
      post.finalScore = (post.finalScore || 0) - penalty;
      diversified.push(post);
      recentAuthors.push(authorStr);
      recentCategories.push(cat);
    }
    // Re-sort after diversity penalty and paginate
    diversified.sort((a, b) => b.finalScore - a.finalScore);
    const pageStart = (parseInt(page) - 1) * parseInt(limit);
    const pagedPosts = diversified.slice(pageStart, pageStart + parseInt(limit));

    // ─── Fallback: if recommendations are empty, show general explore posts ───
    let finalPosts;
    if (pagedPosts.length === 0) {
      // Cold-start or all filtered out — fall back to latest public posts
      let fallbackQuery = { isPrivate: false, group: null };
      if (category && category !== 'all') fallbackQuery.category = category;

      finalPosts = await Post.find(fallbackQuery)
        .populate('user', 'name avatar')
        .populate({
          path: 'comments',
          populate: { path: 'user', select: 'name avatar' },
          options: { limit: 3, sort: { createdAt: -1 } }
        })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .sort({ createdAt: -1 });

      const fallbackTotal = await Post.countDocuments(fallbackQuery);

      return res.json({
        posts: finalPosts,
        totalPages: Math.ceil(fallbackTotal / parseInt(limit)),
        currentPage: parseInt(page)
      });
    }

    // Get total count for pagination
    const totalCount = await Post.countDocuments(matchQuery);

    // Populate the aggregated posts
    const postIds = pagedPosts.map(p => p._id);
    const posts = await Post.find({ _id: { $in: postIds } })
      .populate('user', 'name avatar')
      .populate({
        path: 'comments',
        populate: { path: 'user', select: 'name avatar' },
        options: { limit: 3, sort: { createdAt: -1 } }
      });

    // Maintain recommendation order
    const sortedPosts = postIds.map(id =>
      posts.find(p => p._id.toString() === id.toString())
    ).filter(Boolean);

    // Fire-and-forget view tracking for recommended posts
    if (sortedPosts.length > 0) {
      Promise.allSettled(
        sortedPosts.map(p => UserInteraction.recordInteraction(req.user._id, p._id, 'view'))
      ).catch(() => { });
    }

    res.json({
      posts: sortedPosts,
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get saved posts
router.get('/saved', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const user = await User.findById(req.user._id);
    const allSaved = user.savedPosts || [];
    const total = allSaved.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginatedIds = allSaved.slice(start, start + parseInt(limit));

    const posts = await Post.find({ _id: { $in: paginatedIds } })
      .populate('user', 'name avatar')
      .populate({
        path: 'comments',
        populate: { path: 'user', select: 'name avatar' },
        options: { limit: 3 }
      });

    res.json({
      posts,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get post by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'name avatar bio')
      .populate({
        path: 'comments',
        populate: [
          { path: 'user', select: 'name avatar' },
          { path: 'replies.user', select: 'name avatar' }
        ],
        options: { sort: { createdAt: -1 } }
      });

    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit post
router.put('/:id', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { content, category, tags } = req.body;
    if (content !== undefined) {
      if (!content.trim()) return res.status(400).json({ message: 'Content cannot be empty' });
      post.content = content.trim();
    }
    if (category) post.category = category;
    if (tags) {
      try { post.tags = JSON.parse(tags); }
      catch { post.tags = tags.split(',').map(t => t.trim()).filter(t => t); }
    }

    await post.save();
    const updatedPost = await Post.findById(post._id)
      .populate('user', 'name avatar')
      .populate({
        path: 'comments',
        populate: { path: 'user', select: 'name avatar' },
        options: { limit: 3, sort: { createdAt: -1 } }
      });

    res.json(updatedPost);
  } catch (error) {
    console.error('Edit post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete post
router.delete('/:id', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Clean up image files from disk
    if (post.images && post.images.length > 0) {
      post.images.forEach(filename => {
        const filepath = path.join(__dirname, '..', 'uploads', 'posts', filename);
        fs.unlink(filepath, (err) => {
          if (err && err.code !== 'ENOENT') console.error('File cleanup error:', err);
        });
      });
    }

    await Comment.deleteMany({ post: req.params.id });
    await User.updateMany({ savedPosts: req.params.id }, { $pull: { savedPosts: req.params.id } });
    await post.deleteOne();

    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Like/Unlike post
router.put('/:id/like', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const isLiked = post.likes.includes(req.user._id);

    if (isLiked) {
      post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
    } else {
      post.likes.push(req.user._id);

      if (post.user.toString() !== req.user._id.toString()) {
        const currentUser = await User.findById(req.user._id);
        await User.findByIdAndUpdate(post.user, {
          $push: {
            notifications: {
              $each: [{
                type: 'like',
                from: req.user._id,
                post: post._id,
                message: `${currentUser.name} liked your post`
              }],
              $slice: -100
            }
          }
        });
      }
    }

    await post.save();

    // Track interaction for recommendations
    if (!isLiked) {
      UserInteraction.recordInteraction(req.user._id, post._id, 'like');
    }

    res.json({ likes: post.likes, likesCount: post.likes.length, isLiked: !isLiked });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add comment
router.post('/:id/comment', protect, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment required' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const comment = await Comment.create({
      user: req.user._id,
      post: req.params.id,
      content: content.trim()
    });

    post.comments.push(comment._id);
    await post.save();

    if (post.user.toString() !== req.user._id.toString()) {
      const currentUser = await User.findById(req.user._id);
      await User.findByIdAndUpdate(post.user, {
        $push: {
          notifications: {
            $each: [{
              type: 'comment',
              from: req.user._id,
              post: post._id,
              message: `${currentUser.name} commented on your post`
            }],
            $slice: -100
          }
        }
      });
    }

    await comment.populate('user', 'name avatar');

    // Track interaction for recommendations
    UserInteraction.recordInteraction(req.user._id, post._id, 'comment');

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete comment
router.delete('/:id/comment/:commentId', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    // Only comment owner or post owner can delete
    const isCommentOwner = comment.user.toString() === req.user._id.toString();
    const isPostOwner = post.user.toString() === req.user._id.toString();
    if (!isCommentOwner && !isPostOwner) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    post.comments = post.comments.filter(c => c.toString() !== req.params.commentId);
    await post.save();
    await comment.deleteOne();

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Save/Unsave post
router.put('/:id/save', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const isSaved = user.savedPosts.includes(req.params.id);

    if (isSaved) {
      user.savedPosts = user.savedPosts.filter(id => id.toString() !== req.params.id);
    } else {
      user.savedPosts.push(req.params.id);
    }

    await user.save();

    // Track interaction for recommendations
    if (!isSaved) {
      UserInteraction.recordInteraction(req.user._id, req.params.id, 'save');
    }

    res.json({ isSaved: !isSaved });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;