const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    sessionToken: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    // Context window - stores recent messages for agent context
    context: [{
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
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    // Session metadata
    metadata: {
        location: {
            latitude: Number,
            longitude: Number,
            lastUpdated: Date
        },
        preferences: {
            language: { type: String, default: 'en' },
            region: { type: String, default: 'IN' }
        },
        lastAgentType: {
            type: String,
            enum: ['orchestrator', 'emergency', 'hospital', 'mental_health', 'home_remedy', 'app_navigation'],
            default: 'orchestrator'
        },
        // Symptom assessment state for doctor-like follow-ups
        assessmentState: {
            isActive: { type: Boolean, default: false },
            symptom: String,
            step: { type: Number, default: 0 },
            responses: {
                severity: String,      // mild, moderate, severe
                duration: String,      // hours, days, weeks
                pregnancyStage: String, // trimester or postpartum
                otherSymptoms: String
            },
            startedAt: Date
        },
        // Flag for pending emergency call confirmation
        awaitingCallConfirmation: {
            type: Boolean,
            default: false
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastActive: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for session cleanup
chatSessionSchema.index({ lastActive: 1 });
chatSessionSchema.index({ userId: 1, isActive: 1 });

// Limit context to last 10 messages (to prevent API context overflow)
chatSessionSchema.methods.addToContext = function (message) {
    this.context.push(message);
    if (this.context.length > 10) {
        this.context = this.context.slice(-10);
    }
    this.lastActive = new Date();
    return this.save();
};

// Clear context but keep session
chatSessionSchema.methods.clearContext = function () {
    this.context = [];
    return this.save();
};

// Get formatted context for Gemini
chatSessionSchema.methods.getFormattedContext = function () {
    return this.context.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
    }));
};

// Static method to cleanup stale sessions
chatSessionSchema.statics.cleanupStale = async function (hoursOld = 24) {
    const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    return this.updateMany(
        { lastActive: { $lt: cutoff }, isActive: true },
        { isActive: false }
    );
};

module.exports = mongoose.model('ChatSession', chatSessionSchema);
