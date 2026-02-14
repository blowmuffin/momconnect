const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Post = require('../models/Post');
const { protect } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');

// Escape special regex characters to prevent ReDoS attacks
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Get all users with enhanced search
router.get('/', protect, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    let query = { _id: { $ne: req.user._id } };

    if (search && search.trim()) {
      // Create regex patterns for flexible matching
      const searchTerm = escapeRegex(search.trim());
      const searchWords = search.trim().split(/\s+/).map(w => escapeRegex(w));

      // Build OR conditions for each word
      const wordConditions = searchWords.map(word => ({
        $or: [
          { name: { $regex: word, $options: 'i' } },
          { location: { $regex: word, $options: 'i' } },
          { bio: { $regex: word, $options: 'i' } }
        ]
      }));

      query.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { location: { $regex: searchTerm, $options: 'i' } },
        { bio: { $regex: searchTerm, $options: 'i' } },
        ...wordConditions.flat()
      ];
    }

    const users = await User.find(query)
      .select('name avatar bio location followers following')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });

    // Sort by relevance if searching
    let sortedUsers = users;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      sortedUsers = users.sort((a, b) => {
        // Exact name match gets highest priority
        const aNameExact = a.name.toLowerCase() === searchLower ? 100 : 0;
        const bNameExact = b.name.toLowerCase() === searchLower ? 100 : 0;

        // Name starts with search term
        const aNameStarts = a.name.toLowerCase().startsWith(searchLower) ? 50 : 0;
        const bNameStarts = b.name.toLowerCase().startsWith(searchLower) ? 50 : 0;

        // Name contains search term
        const aNameContains = a.name.toLowerCase().includes(searchLower) ? 25 : 0;
        const bNameContains = b.name.toLowerCase().includes(searchLower) ? 25 : 0;

        // Follower count as tiebreaker
        const aFollowers = (a.followers?.length || 0) * 0.1;
        const bFollowers = (b.followers?.length || 0) * 0.1;

        const aScore = aNameExact + aNameStarts + aNameContains + aFollowers;
        const bScore = bNameExact + bNameStarts + bNameContains + bFollowers;

        return bScore - aScore;
      });
    }

    const total = await User.countDocuments(query);

    res.json({
      users: sortedUsers,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Quick search for navbar/autocomplete
router.get('/search', protect, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ users: [] });
    }

    const searchTerm = escapeRegex(q.trim());

    const users = await User.find({
      _id: { $ne: req.user._id },
      name: { $regex: searchTerm, $options: 'i' }
    })
      .select('name avatar bio location')
      .limit(10);

    // Sort by relevance
    const searchLower = searchTerm.toLowerCase();
    const sortedUsers = users.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(searchLower) ? 2 : 0;
      const bStarts = b.name.toLowerCase().startsWith(searchLower) ? 2 : 0;
      const aContains = a.name.toLowerCase().includes(searchLower) ? 1 : 0;
      const bContains = b.name.toLowerCase().includes(searchLower) ? 1 : 0;
      return (bStarts + bContains) - (aStarts + aContains);
    });

    res.json({ users: sortedUsers });
  } catch (error) {
    console.error('Quick search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get suggested users
router.get('/suggested', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const currentUser = await User.findById(req.user._id);

    const query = {
      _id: { $ne: req.user._id, $nin: currentUser.following }
    };

    const users = await User.find(query)
      .select('name avatar bio location followers')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get notifications
router.get('/notifications', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('notifications.from', 'name avatar')
      .populate('notifications.post', 'content');

    const notifications = user.notifications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notifications as read
router.put('/notifications/read', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $set: { 'notifications.$[].read': true }
    });
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's followers list
router.get('/:id/followers', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('followers', 'name avatar bio location');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.followers || []);
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's following list
router.get('/:id/following', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('following', 'name avatar bio location');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.following || []);
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('followers', 'name avatar')
      .populate('following', 'name avatar')
      .populate('pendingFollowRequests', 'name avatar');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isOwnProfile = req.user._id.toString() === req.params.id;
    const isFollowing = user.followers?.some(f => f._id.toString() === req.user._id.toString());
    const hasPendingRequest = user.pendingFollowRequests?.some(r => r._id.toString() === req.user._id.toString());

    // For private accounts, only show posts if following or own profile
    let posts = [];
    if (!user.isPrivate || isFollowing || isOwnProfile) {
      posts = await Post.find({ user: req.params.id, isPrivate: false, group: null })
        .populate('user', 'name avatar')
        .populate({
          path: 'comments',
          populate: { path: 'user', select: 'name avatar' },
          options: { limit: 3 }
        })
        .sort({ createdAt: -1 });
    }

    res.json({
      user,
      posts,
      isFollowing,
      hasPendingRequest,
      canViewPosts: !user.isPrivate || isFollowing || isOwnProfile
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile
router.put('/profile', protect, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio must be under 500 characters'),
  body('location').optional().trim().isLength({ max: 100 }).withMessage('Location must be under 100 characters'),
  body('isPrivate').optional().isBoolean().withMessage('isPrivate must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { name, bio, location, children, interests, isPrivate } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, bio, location, children, interests, isPrivate },
      { new: true, runValidators: true }
    );

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update avatar
router.put('/avatar', protect, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: req.file.filename },
      { new: true }
    );

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Follow/Unfollow
router.put('/follow/:id', protect, async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isFollowing = currentUser.following.includes(req.params.id);
    const hasPendingRequest = userToFollow.pendingFollowRequests?.includes(req.user._id);

    if (isFollowing) {
      // Unfollow
      await User.findByIdAndUpdate(req.user._id, { $pull: { following: req.params.id } });
      await User.findByIdAndUpdate(req.params.id, { $pull: { followers: req.user._id } });
      return res.json({ isFollowing: false, pending: false });
    } else if (hasPendingRequest) {
      // Cancel pending request
      await User.findByIdAndUpdate(req.params.id, { $pull: { pendingFollowRequests: req.user._id } });
      return res.json({ isFollowing: false, pending: false });
    } else if (userToFollow.isPrivate) {
      // Private account - send follow request
      await User.findByIdAndUpdate(req.params.id, {
        $addToSet: { pendingFollowRequests: req.user._id },
        $push: {
          notifications: {
            $each: [{
              type: 'follow_request',
              from: req.user._id,
              message: `${currentUser.name} requested to follow you`
            }],
            $slice: -100
          }
        }
      });
      return res.json({ isFollowing: false, pending: true });
    } else {
      // Public account - follow directly
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { following: req.params.id } });
      await User.findByIdAndUpdate(req.params.id, {
        $addToSet: { followers: req.user._id },
        $push: {
          notifications: {
            $each: [{
              type: 'follow',
              from: req.user._id,
              message: `${currentUser.name} started following you`
            }],
            $slice: -100
          }
        }
      });
      return res.json({ isFollowing: true, pending: false });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;