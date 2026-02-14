const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Post = require('../models/Post');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { uploadGroup } = require('../middleware/upload');

// Escape special regex characters to prevent ReDoS attacks
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Create group
router.post('/', protect, uploadGroup.single('image'), async (req, res) => {
  try {
    const { name, description, category, isPrivate, rules } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Group name required' });
    }

    let parsedRules = [];
    if (rules) {
      try { parsedRules = JSON.parse(rules); }
      catch { parsedRules = rules.split('\n').filter(r => r.trim()); }
    }

    const group = await Group.create({
      name: name.trim(),
      description: description || '',
      category: category || 'general',
      isPrivate: isPrivate === 'true',
      rules: parsedRules,
      admin: req.user._id,
      image: req.file ? req.file.filename : '',
      members: [{ user: req.user._id, role: 'admin' }]
    });

    await group.populate('admin', 'name avatar');
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all groups
router.get('/', protect, async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12 } = req.query;

    let query = {};
    if (category && category !== 'all') query.category = category;
    if (search) {
      const safeSearch = escapeRegex(search.trim());
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const groups = await Group.find(query)
      .populate('admin', 'name avatar')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Group.countDocuments(query);

    res.json({
      groups,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get my groups
router.get('/my-groups', protect, async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const query = { 'members.user': req.user._id };

    const groups = await Group.find(query)
      .populate('admin', 'name avatar')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ updatedAt: -1 });

    const total = await Group.countDocuments(query);

    res.json({
      groups,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get group by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('admin', 'name avatar')
      .populate('members.user', 'name avatar bio')
      .populate('pendingRequests', 'name avatar');

    if (!group) return res.status(404).json({ message: 'Group not found' });

    const posts = await Post.find({ group: req.params.id })
      .populate('user', 'name avatar')
      .populate({
        path: 'comments',
        populate: { path: 'user', select: 'name avatar' }
      })
      .sort({ createdAt: -1 });

    const isMember = group.members.some(m => m.user._id.toString() === req.user._id.toString());

    res.json({ group, posts, isMember });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Join/Leave group
router.put('/:id/join', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const memberIndex = group.members.findIndex(m => m.user.toString() === req.user._id.toString());
    const isMember = memberIndex !== -1;

    if (isMember) {
      if (group.admin.toString() === req.user._id.toString()) {
        return res.status(400).json({ message: 'Admin cannot leave' });
      }
      group.members.splice(memberIndex, 1);
      await group.save();
      return res.json({ message: 'Left group', isMember: false });
    } else {
      if (group.isPrivate) {
        if (!group.pendingRequests.includes(req.user._id)) {
          group.pendingRequests.push(req.user._id);
          await group.save();
        }
        return res.json({ message: 'Request sent', pending: true });
      }
      group.members.push({ user: req.user._id, role: 'member' });
      await group.save();
      return res.json({ message: 'Joined group', isMember: true });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper: Check if user is admin or moderator
const isAdminOrMod = (group, userId) => {
  const member = group.members.find(m => m.user.toString() === userId.toString());
  return member && ['admin', 'moderator'].includes(member.role);
};

const isAdmin = (group, userId) => {
  return group.admin.toString() === userId.toString();
};

// Kick member from group (Admin/Mod only)
router.delete('/:id/members/:userId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (!isAdminOrMod(group, req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const targetUserId = req.params.userId;

    // Can't kick the admin
    if (isAdmin(group, targetUserId)) {
      return res.status(400).json({ message: 'Cannot remove group admin' });
    }

    // Moderators can't kick other moderators
    const targetMember = group.members.find(m => m.user.toString() === targetUserId);
    if (targetMember?.role === 'moderator' && !isAdmin(group, req.user._id)) {
      return res.status(403).json({ message: 'Only admin can remove moderators' });
    }

    group.members = group.members.filter(m => m.user.toString() !== targetUserId);
    await group.save();

    res.json({ message: 'Member removed', members: group.members });
  } catch (error) {
    console.error('Kick member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Promote member to moderator (Admin only)
router.put('/:id/members/:userId/promote', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (!isAdmin(group, req.user._id)) {
      return res.status(403).json({ message: 'Only admin can promote members' });
    }

    const memberIndex = group.members.findIndex(m => m.user.toString() === req.params.userId);
    if (memberIndex === -1) {
      return res.status(404).json({ message: 'Member not found' });
    }

    if (group.members[memberIndex].role === 'admin') {
      return res.status(400).json({ message: 'Cannot change admin role' });
    }

    group.members[memberIndex].role = 'moderator';
    await group.save();

    res.json({ message: 'Member promoted to moderator', member: group.members[memberIndex] });
  } catch (error) {
    console.error('Promote member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Demote moderator to member (Admin only)
router.put('/:id/members/:userId/demote', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (!isAdmin(group, req.user._id)) {
      return res.status(403).json({ message: 'Only admin can demote moderators' });
    }

    const memberIndex = group.members.findIndex(m => m.user.toString() === req.params.userId);
    if (memberIndex === -1) {
      return res.status(404).json({ message: 'Member not found' });
    }

    if (group.members[memberIndex].role === 'admin') {
      return res.status(400).json({ message: 'Cannot demote admin' });
    }

    group.members[memberIndex].role = 'member';
    await group.save();

    res.json({ message: 'Moderator demoted to member', member: group.members[memberIndex] });
  } catch (error) {
    console.error('Demote member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve join request (Admin/Mod only)
router.put('/:id/requests/:userId/approve', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (!isAdminOrMod(group, req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const requestIndex = group.pendingRequests.findIndex(
      id => id.toString() === req.params.userId
    );

    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Remove from pending and add as member
    group.pendingRequests.splice(requestIndex, 1);
    group.members.push({ user: req.params.userId, role: 'member' });
    await group.save();

    await group.populate('members.user', 'name avatar bio');

    res.json({ message: 'Request approved', members: group.members });
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject join request (Admin/Mod only)
router.delete('/:id/requests/:userId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (!isAdminOrMod(group, req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const requestIndex = group.pendingRequests.findIndex(
      id => id.toString() === req.params.userId
    );

    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Request not found' });
    }

    group.pendingRequests.splice(requestIndex, 1);
    await group.save();

    res.json({ message: 'Request rejected' });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add member directly (Admin only)
router.post('/:id/members/:userId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (!isAdmin(group, req.user._id)) {
      return res.status(403).json({ message: 'Only admin can add members directly' });
    }

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already a member
    const existingMember = group.members.find(m => m.user.toString() === req.params.userId);
    if (existingMember) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    // Remove from pending requests if present
    group.pendingRequests = group.pendingRequests.filter(
      id => id.toString() !== req.params.userId
    );

    group.members.push({ user: req.params.userId, role: 'member' });
    await group.save();

    await group.populate('members.user', 'name avatar bio');

    res.json({ message: 'Member added', members: group.members });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;