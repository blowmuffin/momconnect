const mongoose = require('mongoose');

/**
 * Emergency Log Schema
 * Audit trail for all emergency calls and SMS sent by the system
 */
const emergencyLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatSession'
    },

    // Contact details
    contactName: { type: String, required: true },
    contactPhone: { type: String, required: true },
    contactRelationship: { type: String, default: 'contact' },

    // Call details
    callType: {
        type: String,
        enum: ['voice', 'sms', 'both'],
        required: true
    },
    severity: {
        type: String,
        enum: ['HIGH', 'MEDIUM', 'LOW'],
        required: true
    },

    // What triggered the call
    triggerMessage: { type: String, required: true },

    // Twilio response data
    callSid: String,
    messageSid: String,
    status: {
        type: String,
        enum: ['initiated', 'completed', 'failed', 'busy', 'no-answer', 'cooldown-blocked'],
        default: 'initiated'
    },

    // Error tracking
    error: String,

    // Was this user-confirmed or auto-triggered?
    triggerType: {
        type: String,
        enum: ['auto', 'user-confirmed'],
        default: 'auto'
    }
}, {
    timestamps: true
});

// Index for cooldown checks: recent calls for a user
emergencyLogSchema.index({ userId: 1, createdAt: -1 });
emergencyLogSchema.index({ userId: 1, contactPhone: 1, createdAt: -1 });

/**
 * Check if a call was made recently (within cooldown period)
 * @param {string} userId - User ID
 * @param {string} contactPhone - Contact phone number
 * @param {number} cooldownMinutes - Cooldown period in minutes (default: 30)
 * @returns {boolean} True if a call was made within the cooldown period
 */
emergencyLogSchema.statics.isOnCooldown = async function (userId, contactPhone, cooldownMinutes = 30) {
    const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);

    const recentCall = await this.findOne({
        userId,
        contactPhone,
        createdAt: { $gte: cutoff },
        status: { $ne: 'failed' } // Don't count failed attempts
    });

    return !!recentCall;
};

/**
 * Get recent emergency logs for a user
 */
emergencyLogSchema.statics.getRecentLogs = function (userId, limit = 10) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
};

module.exports = mongoose.model('EmergencyLog', emergencyLogSchema);
