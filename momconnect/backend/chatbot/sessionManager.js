/**
 * Session Manager
 * Handles session creation, context management, and message persistence
 */

const crypto = require('crypto');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const config = require('./config');
const geminiClient = require('./tools/geminiClient');

class SessionManager {
    /**
     * Create a new chat session for a user
     * @param {string} userId - User's MongoDB ID
     * @returns {Object} New session
     */
    async createSession(userId, skipExistingCheck = false) {
        if (!skipExistingCheck) {
            // Check for existing active session
            const existingSession = await ChatSession.findOne({
                userId,
                isActive: true
            });

            if (existingSession) {
                // Update last active and return existing
                existingSession.lastActive = new Date();
                await existingSession.save();
                return existingSession;
            }
        }

        // Create new session
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const session = new ChatSession({
            userId,
            sessionToken,
            context: [],
            metadata: {
                preferences: {
                    language: 'en',
                    region: 'IN'
                }
            }
        });

        await session.save();
        return session;
    }

    /**
     * Get active session for a user
     * @param {string} userId - User's MongoDB ID
     * @returns {Object|null} Active session or null
     */
    async getSession(userId) {
        const session = await ChatSession.findOne({
            userId,
            isActive: true
        });

        if (session) {
            // Check if session is stale
            const hoursSinceActive = (Date.now() - session.lastActive) / (1000 * 60 * 60);
            if (hoursSinceActive > config.context.sessionTimeoutHours) {
                session.isActive = false;
                await session.save();
                return null;
            }
        }

        return session;
    }

    /**
     * Get or create session for a user
     * @param {string} userId - User's MongoDB ID
     * @returns {Object} Session
     */
    async getOrCreateSession(userId) {
        let session = await this.getSession(userId);
        if (!session) {
            // Pass skipExistingCheck since we already checked
            session = await this.createSession(userId, true);
        }
        return session;
    }

    /**
     * Add a message to session context
     * @param {string} sessionId - Session MongoDB ID
     * @param {Object} message - Message object {role, content, agentType}
     */
    async updateContext(sessionId, message) {
        const session = await ChatSession.findById(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        await session.addToContext({
            role: message.role,
            content: message.content,
            agentType: message.agentType || 'orchestrator',
            timestamp: new Date()
        });

        // Update last agent type
        if (message.agentType) {
            session.metadata.lastAgentType = message.agentType;
            await session.save();
        }

        // Sliding-window context summarization
        const maxContextLen = config.context?.maxContextLength || 20;
        if (session.context.length > maxContextLen) {
            await this._summarizeOldContext(session, maxContextLen);
        }

        return session;
    }

    /**
     * Compress older context messages into a summary to keep context within bounds.
     * Keeps the most recent messages and replaces older ones with a single summary entry.
     */
    async _summarizeOldContext(session, maxContextLen) {
        try {
            const keepCount = Math.floor(maxContextLen * 0.6); // Keep 60% recent
            const toSummarize = session.context.slice(0, session.context.length - keepCount);
            const toKeep = session.context.slice(session.context.length - keepCount);

            if (toSummarize.length < 4) return; // Not enough to summarize

            // Build a short summary of older messages
            const formattedForSummary = toSummarize.map(c => ({
                role: c.role,
                content: c.content?.substring(0, 200) || ''
            }));

            let summaryText;
            if (geminiClient.isAvailable()) {
                summaryText = await geminiClient.summarizeConversation(formattedForSummary);
            }

            if (!summaryText) {
                // Fallback: simple truncation
                summaryText = toSummarize
                    .filter(c => c.role === 'user')
                    .map(c => c.content?.substring(0, 60))
                    .join('; ');
            }

            // Replace context with summary + recent messages
            const summaryEntry = {
                role: 'user',
                content: `[System: Earlier conversation summary — ${summaryText}]`,
                agentType: 'orchestrator',
                timestamp: new Date()
            };

            session.context = [summaryEntry, ...toKeep];
            session.markModified('context');
            await session.save();

            console.log(`[SessionManager] Compressed context: ${toSummarize.length + toKeep.length} → ${session.context.length} entries`);
        } catch (err) {
            console.error('[SessionManager] Context summarization error:', err.message);
            // Non-fatal: just trim the oldest entries as fallback
            const keepCount = Math.floor(maxContextLen * 0.7);
            session.context = session.context.slice(-keepCount);
            session.markModified('context');
            await session.save();
        }
    }

    /**
     * Update session metadata fields
     * @param {string} sessionId - Session MongoDB ID
     * @param {Object} updates - Object with dot-notation keys and values
     */
    async updateMetadata(sessionId, updates) {
        return ChatSession.findByIdAndUpdate(sessionId, { $set: updates }, { new: true });
    }

    /**
     * Save a message to the database
     * @param {Object} params - Message parameters
     * @returns {Object} Saved message
     */
    async saveMessage({ sessionId, userId, role, content, agentType, metadata, parentMessageId }) {
        const message = new ChatMessage({
            sessionId,
            userId,
            role,
            content,
            agentType: agentType || 'orchestrator',
            metadata: metadata || {},
            parentMessageId
        });

        await message.save();
        return message;
    }

    /**
     * Get chat history for a session
     * @param {string} sessionId - Session MongoDB ID
     * @param {number} limit - Maximum messages to return
     * @param {Date} before - Get messages before this timestamp
     * @returns {Array} Messages
     */
    async getHistory(sessionId, limit = 50, before = null) {
        return ChatMessage.getHistory(sessionId, limit, before);
    }

    /**
     * Get formatted context for Gemini API
     * @param {string} sessionId - Session MongoDB ID
     * @returns {Array} Formatted context
     */
    async getFormattedContext(sessionId) {
        const session = await ChatSession.findById(sessionId);
        if (!session) {
            return [];
        }
        return session.getFormattedContext();
    }

    /**
     * Update user location in session
     * @param {string} sessionId - Session MongoDB ID
     * @param {number} latitude 
     * @param {number} longitude 
     */
    async updateLocation(sessionId, latitude, longitude) {
        await ChatSession.findByIdAndUpdate(sessionId, {
            'metadata.location': {
                latitude,
                longitude,
                lastUpdated: new Date()
            }
        });
    }

    /**
     * Get user location from session
     * @param {string} sessionId - Session MongoDB ID
     * @returns {Object|null} Location or null
     */
    async getLocation(sessionId) {
        const session = await ChatSession.findById(sessionId);
        if (!session?.metadata?.location?.latitude) {
            return null;
        }
        return session.metadata.location;
    }

    /**
     * Clear session context (new conversation)
     * @param {string} sessionId - Session MongoDB ID
     */
    async clearContext(sessionId) {
        const session = await ChatSession.findById(sessionId);
        if (session) {
            await session.clearContext();
        }
    }

    /**
     * End a session — generate conversation summary for memory before closing
     * @param {string} sessionId - Session MongoDB ID
     */
    async endSession(sessionId) {
        const session = await ChatSession.findById(sessionId);
        if (!session) return;

        // Generate a conversation summary if there were meaningful messages
        if (session.context?.length >= 4) {
            try {
                const memoryManager = require('./memoryManager');
                await memoryManager.addEpisodicSummary(session.userId, sessionId);
            } catch (err) {
                console.error('[SessionManager] Failed to generate end-of-session summary:', err.message);
            }
        }

        session.isActive = false;
        await session.save();
    }

    /**
     * Cleanup stale sessions (run periodically)
     */
    async cleanupStaleSessions() {
        const result = await ChatSession.cleanupStale(config.context.sessionTimeoutHours);
        console.log(`Cleaned up ${result.modifiedCount} stale sessions`);
        return result.modifiedCount;
    }
}

// Export singleton instance
module.exports = new SessionManager();
