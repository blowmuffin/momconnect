const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { Message, Conversation } = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { uploadMessage } = require('../middleware/upload');

// Note: Message upload directory is created by middleware/upload.js

// Get conversations
router.get('/conversations', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const query = { participants: req.user._id };

    const conversations = await Conversation.find(query)
      .populate('participants', 'name avatar isOnline lastSeen')
      .populate('lastMessage')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ updatedAt: -1 });

    const total = await Conversation.countDocuments(query);

    res.json({
      conversations,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages with user
router.get('/:userId', protect, async (req, res) => {
  try {
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, req.params.userId] }
    });

    if (!conversation) return res.json([]);

    const messages = await Message.find({ conversation: conversation._id })
      .populate('sender', 'name avatar')
      .populate('receiver', 'name avatar')
      .sort({ createdAt: 1 });

    await Message.updateMany(
      { conversation: conversation._id, receiver: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send text message
router.post('/:userId', protect, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message required' });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, req.params.userId] }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, req.params.userId]
      });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      receiver: req.params.userId,
      content: content.trim(),
      messageType: 'text'
    });

    conversation.lastMessage = message._id;
    await conversation.save();

    const sender = await User.findById(req.user._id);
    await User.findByIdAndUpdate(req.params.userId, {
      $push: {
        notifications: {
          $each: [{
            type: 'message',
            from: req.user._id,
            message: `${sender.name} sent you a message`
          }],
          $slice: -100
        }
      }
    });

    await message.populate('sender', 'name avatar');
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send message with media attachments
router.post('/:userId/media', protect, uploadMessage.array('media', 5), async (req, res) => {
  try {
    const { content } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'At least one media file is required' });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, req.params.userId] }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, req.params.userId]
      });
    }

    // Process attachments
    const attachments = files.map(file => {
      const isVideo = file.mimetype.startsWith('video/');
      return {
        type: isVideo ? 'video' : 'image',
        url: `/uploads/messages/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype
      };
    });

    // Determine message type
    let messageType = 'image';
    const hasVideo = attachments.some(a => a.type === 'video');
    const hasImage = attachments.some(a => a.type === 'image');
    if (hasVideo && hasImage) {
      messageType = 'mixed';
    } else if (hasVideo) {
      messageType = 'video';
    }
    if (content && content.trim()) {
      messageType = 'mixed';
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      receiver: req.params.userId,
      content: content?.trim() || '',
      messageType,
      attachments
    });

    conversation.lastMessage = message._id;
    await conversation.save();

    // Send notification
    const sender = await User.findById(req.user._id);
    const notificationText = hasVideo
      ? `${sender.name} sent you a video`
      : `${sender.name} sent you a photo`;

    await User.findByIdAndUpdate(req.params.userId, {
      $push: {
        notifications: {
          $each: [{
            type: 'message',
            from: req.user._id,
            message: notificationText
          }],
          $slice: -100
        }
      }
    });

    await message.populate('sender', 'name avatar');
    res.status(201).json(message);
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Error handler for multer
const multer = require('multer');
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 25MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Too many files. Maximum is 5 files per message.' });
    }
    return res.status(400).json({ message: error.message });
  }
  if (error) {
    return res.status(400).json({ message: error.message });
  }
  next();
});

module.exports = router;