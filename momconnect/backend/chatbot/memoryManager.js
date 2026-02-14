/**
 * Memory Manager
 * Handles long-term memory, episodic summaries, and user profile extraction
 */

const UserMemory = require('../models/UserMemory');
const geminiClient = require('./tools/geminiClient');
const ChatMessage = require('../models/ChatMessage');

class MemoryManager {
    /**
     * Get or create user memory
     * @param {string} userId - User's MongoDB ID
     * @returns {Object} UserMemory document
     */
    async getUserMemory(userId) {
        let memory = await UserMemory.findOne({ userId });
        if (!memory) {
            memory = new UserMemory({ userId });
            await memory.save();
        }
        return memory;
    }

    /**
     * Get formatted memory context string for agent prompts
     * @param {string} userId - User's MongoDB ID
     * @returns {string} Context string
     */
    async getMemoryContext(userId) {
        const memory = await this.getUserMemory(userId);
        const parts = [];

        // Profile info
        if (memory.profile.name || memory.profile.preferredName) {
            parts.push(`Name: ${memory.profile.preferredName || memory.profile.name}`);
        }
        if (memory.profile.pregnancyStage) {
            const stages = {
                'first_trimester': 'First trimester (1-12 weeks)',
                'second_trimester': 'Second trimester (13-26 weeks)',
                'third_trimester': 'Third trimester (27-40 weeks)',
                'postpartum': 'Postpartum'
            };
            parts.push(`Stage: ${stages[memory.profile.pregnancyStage] || memory.profile.pregnancyStage}`);
        }
        if (memory.profile.babyAge) {
            parts.push(`Baby age: ${memory.profile.babyAge}`);
        }
        if (memory.profile.knownConditions && memory.profile.knownConditions.length > 0) {
            parts.push(`Known conditions: ${memory.profile.knownConditions.join(', ')}`);
        }

        // Recent topics (last 3)
        const recentTopics = memory.pastTopics
            .sort((a, b) => new Date(b.lastDiscussed) - new Date(a.lastDiscussed))
            .slice(0, 3);
        if (recentTopics.length > 0) {
            const topicStr = recentTopics.map(t => t.summary || t.topic).join('; ');
            parts.push(`Recent concerns: ${topicStr}`);
        }

        // Last episodic summary
        if (memory.episodicSummaries.length > 0) {
            const lastSummary = memory.episodicSummaries[memory.episodicSummaries.length - 1];
            parts.push(`Last conversation: ${lastSummary.summary}`);
        }

        return parts.join('. ');
    }

    /**
     * Update memory from a conversation exchange
     * @param {string} userId - User's MongoDB ID
     * @param {string} userMessage - User's message
     * @param {string} botResponse - Bot's response
     * @param {string} agentType - Agent that handled it
     */
    async updateFromConversation(userId, userMessage, botResponse, agentType) {
        try {
            const memory = await this.getUserMemory(userId);

            // Try to extract profile info — rate-limit to avoid excessive API calls
            // Only extract profile from longer messages likely to contain personal info
            if (userMessage.length > 15) {
                try {
                    const profileInfo = await geminiClient.extractProfileInfo(userMessage);
                    if (profileInfo && typeof profileInfo === 'object') {
                        // Validate: only allow known profile fields
                        const allowedKeys = ['name', 'preferredName', 'pregnancyStage', 'babyAge', 'knownConditions', 'location', 'language'];
                        const safeProfile = {};
                        for (const key of allowedKeys) {
                            if (profileInfo[key] !== undefined && profileInfo[key] !== null && profileInfo[key] !== '') {
                                safeProfile[key] = profileInfo[key];
                            }
                        }
                        if (Object.keys(safeProfile).length > 0) {
                            await memory.updateProfile(safeProfile);
                            console.log(`[MemoryManager] Profile updated for user ${userId}:`, safeProfile);
                        }
                    }
                } catch (profileError) {
                    // Profile extraction is non-critical — log and continue
                    console.warn('[MemoryManager] Profile extraction failed (non-fatal):', profileError.message);
                }
            }

            // Track the topic
            const topic = this.extractTopic(userMessage, agentType);
            if (topic) {
                await memory.addTopic({
                    topic: topic,
                    agentType: agentType,
                    summary: userMessage.substring(0, 100),
                    lastDiscussed: new Date()
                });
            }

            // Update last active
            memory.insights.lastActiveAt = new Date();
            await memory.save();
        } catch (error) {
            console.error('[MemoryManager] Update error:', error.message);
        }
    }

    /**
     * Generate and store an episodic summary for a completed session
     * @param {string} userId - User's MongoDB ID
     * @param {string} sessionId - Session MongoDB ID
     */
    async addEpisodicSummary(userId, sessionId) {
        try {
            const memory = await this.getUserMemory(userId);

            // Check if we already have a summary for this session
            if (memory.episodicSummaries.some(s => s.sessionId?.toString() === sessionId.toString())) {
                return;
            }

            // Get the session's messages
            const messages = await ChatMessage.find({ sessionId })
                .sort({ timestamp: 1 })
                .limit(40)
                .lean();

            if (messages.length < 2) return;

            // Generate summary using Gemini
            const formattedMessages = messages.map(m => ({
                role: m.role,
                content: m.content
            }));

            const summary = await geminiClient.summarizeConversation(formattedMessages);
            if (!summary) return;

            // Extract key topics
            const keyTopics = this.extractKeyTopics(messages);

            // Detect mood from the conversation
            const mood = this.detectOverallMood(messages);

            await memory.addEpisodicSummary({
                sessionId,
                summary,
                keyTopics,
                mood,
                createdAt: new Date()
            });

            // Update insights
            memory.insights.totalSessions = (memory.insights.totalSessions || 0) + 1;
            memory.insights.lastMoodTrend = mood;
            await memory.save();

            console.log(`[MemoryManager] Episodic summary saved for session ${sessionId}`);
        } catch (error) {
            console.error('[MemoryManager] Episodic summary error:', error.message);
        }
    }

    /**
     * Extract a simple topic label from the message and agent type
     */
    extractTopic(message, agentType) {
        const lowerMsg = message.toLowerCase();
        const topicMappings = {
            'home_remedy': {
                'nausea': 'nausea/morning sickness',
                'morning sickness': 'nausea/morning sickness',
                'back pain': 'back pain',
                'heartburn': 'heartburn',
                'swelling': 'swelling',
                'constipation': 'constipation',
                'fatigue': 'fatigue',
                'headache': 'headache'
            },
            'mental_health': {
                'anxiety': 'anxiety',
                'anxious': 'anxiety',
                'depression': 'depression',
                'depressed': 'depression',
                'stress': 'stress management',
                'sleep': 'sleep issues',
                'lonely': 'loneliness',
                'overwhelmed': 'feeling overwhelmed',
                'postpartum': 'postpartum adjustment'
            },
            'hospital': {
                'hospital': 'hospital search',
                'doctor': 'finding a doctor',
                'clinic': 'clinic search'
            }
        };

        const mappings = topicMappings[agentType] || {};
        for (const [keyword, topic] of Object.entries(mappings)) {
            if (lowerMsg.includes(keyword)) {
                return topic;
            }
        }

        return agentType === 'emergency' ? 'crisis support' : null;
    }

    /**
     * Extract key topics from a list of messages
     */
    extractKeyTopics(messages) {
        const topics = new Set();
        const agentTypes = new Set();

        messages.forEach(msg => {
            if (msg.agentType) agentTypes.add(msg.agentType);
            if (msg.metadata?.intentClassification) {
                topics.add(msg.metadata.intentClassification.toLowerCase().replace(/_/g, ' '));
            }
        });

        agentTypes.forEach(agent => {
            const label = {
                'home_remedy': 'home remedies',
                'mental_health': 'emotional support',
                'hospital': 'hospital search',
                'emergency': 'crisis support'
            }[agent];
            if (label) topics.add(label);
        });

        return Array.from(topics).slice(0, 5);
    }

    /**
     * Detect overall mood from conversation messages
     */
    detectOverallMood(messages) {
        const userMessages = messages.filter(m => m.role === 'user');
        const allText = userMessages.map(m => m.content.toLowerCase()).join(' ');

        const moodSignals = {
            positive: ['thank', 'better', 'happy', 'great', 'good', 'helpful', 'appreciate', 'wonderful'],
            negative: ['sad', 'anxious', 'scared', 'worried', 'stressed', 'overwhelmed', 'crying', 'hurt'],
            neutral: ['okay', 'fine', 'alright']
        };

        let posCount = 0, negCount = 0;
        moodSignals.positive.forEach(w => { if (allText.includes(w)) posCount++; });
        moodSignals.negative.forEach(w => { if (allText.includes(w)) negCount++; });

        if (negCount > posCount) return 'concerned';
        if (posCount > negCount) return 'positive';
        return 'neutral';
    }
}

module.exports = new MemoryManager();
