const mongoose = require('mongoose');

const userMemorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },

    // User profile extracted from conversations
    profile: {
        name: { type: String, default: '' },
        preferredName: { type: String, default: '' },
        pregnancyStage: { type: String, default: '' }, // first_trimester, second_trimester, third_trimester, postpartum
        dueDate: Date,
        babyAge: { type: String, default: '' },
        knownConditions: [String]
    },

    // User preferences learned over time
    preferences: {
        communicationStyle: { type: String, default: 'warm' }, // warm, concise, detailed
        language: { type: String, default: 'en' },
        voiceEnabled: { type: Boolean, default: false }
    },

    // Topics discussed across sessions
    pastTopics: [{
        topic: String,
        agentType: String,
        summary: String,
        lastDiscussed: { type: Date, default: Date.now },
        resolved: { type: Boolean, default: false }
    }],

    // Summaries of past sessions (episodic memory)
    episodicSummaries: [{
        sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession' },
        summary: String,
        keyTopics: [String],
        mood: String,
        createdAt: { type: Date, default: Date.now }
    }],

    // Computed insights
    insights: {
        frequentConcerns: [String],
        recommendedFollowUps: [String],
        lastMoodTrend: { type: String, default: 'neutral' },
        totalSessions: { type: Number, default: 0 },
        lastActiveAt: Date
    }
}, {
    timestamps: true
});

// Index for quick lookup
userMemorySchema.index({ 'profile.name': 'text' });

// Limit episodic summaries to last 20
userMemorySchema.methods.addEpisodicSummary = function (summary) {
    this.episodicSummaries.push(summary);
    if (this.episodicSummaries.length > 20) {
        this.episodicSummaries = this.episodicSummaries.slice(-20);
    }
    return this.save();
};

// Limit past topics to last 30
userMemorySchema.methods.addTopic = function (topic) {
    // Check if topic already exists and update it
    const existing = this.pastTopics.find(t => t.topic === topic.topic && t.agentType === topic.agentType);
    if (existing) {
        existing.lastDiscussed = new Date();
        existing.summary = topic.summary || existing.summary;
    } else {
        this.pastTopics.push(topic);
        if (this.pastTopics.length > 30) {
            this.pastTopics = this.pastTopics.slice(-30);
        }
    }
    this.markModified('pastTopics');
    return this.save();
};

// Update profile fields (only non-empty values)
userMemorySchema.methods.updateProfile = function (profileData) {
    if (profileData.name && !this.profile.name) {
        this.profile.name = profileData.name;
        if (!this.profile.preferredName) {
            this.profile.preferredName = profileData.name;
        }
    }
    if (profileData.pregnancyStage) {
        this.profile.pregnancyStage = profileData.pregnancyStage;
    }
    if (profileData.dueDate) {
        this.profile.dueDate = profileData.dueDate;
    }
    if (profileData.babyAge) {
        this.profile.babyAge = profileData.babyAge;
    }
    if (profileData.conditions && Array.isArray(profileData.conditions)) {
        const existingConditions = new Set(this.profile.knownConditions);
        profileData.conditions.forEach(c => existingConditions.add(c));
        this.profile.knownConditions = Array.from(existingConditions);
    }
    this.markModified('profile');
    return this.save();
};

module.exports = mongoose.model('UserMemory', userMemorySchema);
