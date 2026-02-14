/**
 * Chatbot API Routes
 * Endpoints for AI chatbot interactions
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const { orchestrator, sessionManager } = require('../chatbot');

// Per-user rate limiter for chatbot messages: max 20 per minute
const chatbotLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    keyGenerator: (req) => req.user?.id || req.ip,
    message: {
        success: false,
        error: 'Too many messages. Please wait a moment before sending more.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * @route   POST /api/chatbot/message
 * @desc    Send a message and get AI response
 * @access  Private
 */
router.post('/message', protect, chatbotLimiter, async (req, res) => {
    try {
        let { message, latitude, longitude } = req.body;
        const userId = req.user.id;

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        // Truncate to 2000 characters to prevent excessive API token usage
        message = message.trim().slice(0, 2000);

        // Process message through orchestrator
        const response = await orchestrator.processMessage(
            message,
            userId,
            { latitude, longitude }
        );

        res.json(response);
    } catch (error) {
        console.error('Chatbot message error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process message'
        });
    }
});

/**
 * @route   GET /api/chatbot/history
 * @desc    Get chat history
 * @access  Private
 */
router.get('/history', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;

        const history = await orchestrator.getHistory(userId, limit);

        res.json({
            success: true,
            messages: history.reverse(), // Chronological order
            count: history.length
        });
    } catch (error) {
        console.error('Chatbot history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch history'
        });
    }
});

/**
 * @route   POST /api/chatbot/session
 * @desc    Create or get current session
 * @access  Private
 */
router.post('/session', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const session = await sessionManager.getOrCreateSession(userId);

        res.json({
            success: true,
            session: {
                id: session._id,
                createdAt: session.createdAt,
                lastActive: session.lastActive,
                messageCount: session.context.length
            }
        });
    } catch (error) {
        console.error('Session creation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create session'
        });
    }
});

/**
 * @route   GET /api/chatbot/session
 * @desc    Get current session info
 * @access  Private
 */
router.get('/session', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const sessionInfo = await orchestrator.getSessionInfo(userId);

        if (!sessionInfo) {
            return res.json({
                success: true,
                session: null,
                message: 'No active session'
            });
        }

        res.json({
            success: true,
            session: sessionInfo
        });
    } catch (error) {
        console.error('Get session error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get session info'
        });
    }
});

/**
 * @route   DELETE /api/chatbot/session
 * @desc    Clear session context or end session
 * @access  Private
 */
router.delete('/session', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { clearOnly } = req.query;

        if (clearOnly === 'true') {
            await orchestrator.clearContext(userId);
            res.json({
                success: true,
                message: 'Conversation cleared. Starting fresh!'
            });
        } else {
            await orchestrator.endSession(userId);
            res.json({
                success: true,
                message: 'Session ended'
            });
        }
    } catch (error) {
        console.error('Session delete error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear session'
        });
    }
});

/**
 * @route   POST /api/chatbot/location
 * @desc    Update user location for hospital searches
 * @access  Private
 */
router.post('/location', protect, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const userId = req.user.id;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }

        const session = await sessionManager.getOrCreateSession(userId);
        await sessionManager.updateLocation(session._id, latitude, longitude);

        res.json({
            success: true,
            message: 'Location updated'
        });
    } catch (error) {
        console.error('Location update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update location'
        });
    }
});

/**
 * @route   GET /api/chatbot/twilio-status
 * @desc    Diagnose Twilio configuration (for debugging emergency calls)
 * @access  Private
 */
router.get('/twilio-status', protect, async (req, res) => {
    try {
        const twilioClient = require('../chatbot/tools/twilioClient');
        const diagnosis = twilioClient.diagnose();

        res.json({
            success: true,
            twilio: diagnosis,
            actionRequired: !diagnosis.isAvailable
                ? diagnosis.initError || 'Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env'
                : null
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route   GET /api/chatbot/health
 * @desc    Health check for chatbot system
 * @access  Public
 */
router.get('/health', async (req, res) => {
    try {
        const health = await orchestrator.healthCheck();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/chatbot/emergency-contact
 * @desc    Get user's emergency contact
 * @access  Private
 */
router.get('/emergency-contact', protect, async (req, res) => {
    try {
        const User = require('../models/User');
        const user = await User.findById(req.user.id).select('emergencyContact');

        res.json({
            success: true,
            emergencyContact: user?.emergencyContact || {}
        });
    } catch (error) {
        console.error('Get emergency contact error:', error);
        res.status(500).json({ success: false, error: 'Failed to get emergency contact' });
    }
});

/**
 * @route   POST /api/chatbot/emergency-contact
 * @desc    Save/update user's emergency contact
 * @access  Private
 */
router.post('/emergency-contact', protect, async (req, res) => {
    try {
        const { name, phone, relationship, autoCallEnabled } = req.body;

        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Name and phone number are required'
            });
        }

        // Strip spaces, dashes, dots from phone before validating
        let cleanPhone = phone.replace(/[\s\-\.\(\)]/g, '');

        // Auto-prepend +91 if user entered just 10 digits
        if (/^[6-9]\d{9}$/.test(cleanPhone)) {
            cleanPhone = '+91' + cleanPhone;
        }
        // Accept +91 followed by 10 digits starting with 6-9
        if (!/^\+91[6-9]\d{9}$/.test(cleanPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid Indian phone number (e.g., 9876543210 or +919876543210)'
            });
        }

        const User = require('../models/User');
        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                emergencyContact: {
                    name: name.trim(),
                    phone: cleanPhone,
                    relationship: (relationship || 'contact').trim(),
                    autoCallEnabled: autoCallEnabled !== false // defaults to true
                }
            },
            { new: true }
        ).select('emergencyContact');

        res.json({
            success: true,
            message: 'Emergency contact saved',
            emergencyContact: user.emergencyContact
        });
    } catch (error) {
        console.error('Save emergency contact error:', error);
        res.status(500).json({ success: false, message: 'Failed to save emergency contact' });
    }
});

/**
 * @route   GET /api/chatbot/user-data
 * @desc    Get what the bot remembers about the user
 * @access  Private
 */
router.get('/user-data', protect, async (req, res) => {
    try {
        const UserMemory = require('../models/UserMemory');
        const memory = await UserMemory.findOne({ userId: req.user.id }).lean();

        if (!memory) {
            return res.json({
                success: true,
                data: null,
                message: 'No stored data found'
            });
        }

        res.json({
            success: true,
            data: {
                profile: memory.profile || {},
                recentTopics: (memory.pastTopics || []).slice(-10),
                episodicSummaries: (memory.episodicSummaries || []).slice(-5),
                insights: memory.insights || {},
                lastUpdated: memory.updatedAt
            }
        });
    } catch (error) {
        console.error('Get user data error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve user data' });
    }
});

/**
 * @route   DELETE /api/chatbot/user-data
 * @desc    Delete all stored memory/data about the user
 * @access  Private
 */
router.delete('/user-data', protect, async (req, res) => {
    try {
        const UserMemory = require('../models/UserMemory');
        await UserMemory.deleteOne({ userId: req.user.id });

        res.json({
            success: true,
            message: 'All stored data has been deleted'
        });
    } catch (error) {
        console.error('Delete user data error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete user data' });
    }
});

module.exports = router;
