const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatSession',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    agentType: {
        type: String,
        enum: ['orchestrator', 'emergency', 'hospital', 'mental_health', 'home_remedy', 'app_navigation'],
        default: 'orchestrator'
    },
    // Metadata for analytics and debugging
    metadata: {
        responseTimeMs: Number,
        tokensUsed: {
            prompt: Number,
            completion: Number,
            total: Number
        },
        intentClassification: {
            type: String,
            enum: ['EMERGENCY', 'HOSPITAL_SEARCH', 'MENTAL_HEALTH', 'HOME_REMEDY', 'GREETING', 'APP_NAVIGATION', 'GENERAL']
        },
        confidence: Number,
        // For hospital searches
        searchResults: [{
            placeId: String,
            name: String,
            address: String,
            distance: Number
        }]
    },
    // For linking follow-up messages
    parentMessageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatMessage'
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Compound index for efficient history queries
chatMessageSchema.index({ sessionId: 1, timestamp: -1 });
chatMessageSchema.index({ userId: 1, timestamp: -1 });

// Get messages for a session with pagination
chatMessageSchema.statics.getHistory = async function (sessionId, limit = 50, before = null) {
    const query = { sessionId };
    if (before) {
        query.timestamp = { $lt: before };
    }
    return this.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
};

// Get recent messages for context
chatMessageSchema.statics.getRecentForContext = async function (sessionId, limit = 20) {
    const messages = await this.find({ sessionId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
    return messages.reverse(); // Return in chronological order
};

// Analytics: Get message counts by agent type
chatMessageSchema.statics.getAgentStats = async function (userId, startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                role: 'assistant',
                timestamp: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$agentType',
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$metadata.responseTimeMs' }
            }
        }
    ]);
};

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
