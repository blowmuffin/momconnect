/**
 * Mental Health Wellbeing Agent
 * Provides supportive responses for mental health and emotional wellbeing
 */

const geminiClient = require('../tools/geminiClient');
const config = require('../config');
const UserMemory = require('../../models/UserMemory');

class MentalHealthAgent {
    constructor() {
        this.agentType = 'mental_health';
        this.systemPrompt = config.systemPrompts.mentalHealth;
    }

    /**
     * Process a mental health related query
     * @param {string} message - User's message
     * @param {Array} context - Conversation history
     * @param {Object} session - Session object
     * @returns {Object} Supportive response
     */
    async process(message, context = [], session = null) {
        try {
            // Check for potential crisis escalation
            if (this.shouldEscalateToCrisis(message)) {
                return {
                    text: null,
                    escalate: true,
                    escalateTo: 'emergency',
                    reason: 'Crisis indicators detected in mental health query'
                };
            }

            // Enhance the prompt with context awareness and memory
            const userId = session?.userId || session?.metadata?.userId;
            const enhancedPrompt = await this.enhancePrompt(message, session, userId);

            // Generate supportive response with variety injection
            const styleDirectives = config.responseStyleDirectives || [];
            const styleDirective = styleDirectives.length > 0
                ? styleDirectives[Math.floor(Math.random() * styleDirectives.length)]
                : '';
            const enhancedSystemPrompt = styleDirective
                ? `${this.systemPrompt}\n\nSTYLE FOR THIS RESPONSE: ${styleDirective}`
                : this.systemPrompt;

            const response = await geminiClient.generateResponse(
                enhancedPrompt,
                enhancedSystemPrompt,
                context
            );

            // Add self-care suggestions for certain topics
            let finalResponse = this.addSelfCareSuggestions(response.text, message);

            // Add AI disclaimer on first interaction in session
            const isFirstMentalHealthMsg = !session?.metadata?.mentalHealthDisclaimer;
            if (isFirstMentalHealthMsg) {
                finalResponse = `⚕️ *I'm an AI companion here to listen and support you, but I'm not a therapist or counselor. For professional help, please reach out to a qualified mental health professional.*\n\n${finalResponse}`;
                if (session) {
                    session.metadata.mentalHealthDisclaimer = true;
                    session.markModified('metadata');
                    await session.save().catch(() => { });
                }
            }

            return {
                text: finalResponse,
                agentType: this.agentType,
                metadata: {
                    ...response.metadata,
                    topic: this.identifyTopic(message)
                }
            };
        } catch (error) {
            console.error('Mental health agent error:', error);
            return this.getFallbackResponse();
        }
    }

    /**
     * Enhance prompt with relevant context
     */
    async enhancePrompt(message, session, userId = null) {
        let contextNote = '';

        // Add time-relevant context
        const hour = new Date().getHours();
        if (hour >= 22 || hour < 6) {
            contextNote += 'Note: It\'s late night/early morning - the user might be having trouble sleeping or feeling lonely. ';
        }

        // Add maternal context hints based on message
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('baby') || lowerMessage.includes('newborn')) {
            contextNote += 'The user seems to have a newborn - be mindful of postpartum context. ';
        }
        if (lowerMessage.includes('pregnant') || lowerMessage.includes('pregnancy')) {
            contextNote += 'The user is pregnant - consider pregnancy-related emotional changes. ';
        }

        // Add memory context for continuity
        if (userId) {
            try {
                const memory = await UserMemory.findOne({ userId }).lean();
                if (memory?.topics?.length > 0) {
                    const recentTopics = memory.topics.slice(-5);
                    contextNote += `Past conversation topics with this user: ${recentTopics.join(', ')}. `;
                }
                if (memory?.profile?.pregnancyStage) {
                    contextNote += `User is in: ${memory.profile.pregnancyStage}. `;
                }
            } catch (e) {
                // Non-blocking memory lookup
            }
        }

        return contextNote ? `${contextNote}\n\nUser message: ${message}` : message;
    }

    /**
     * Check if message should escalate to emergency agent
     */
    shouldEscalateToCrisis(message) {
        return geminiClient.quickCrisisCheck(message);
    }

    /**
     * Identify the mental health topic
     */
    identifyTopic(message) {
        const lowerMessage = message.toLowerCase();

        const topics = {
            'postpartum_depression': ['postpartum', 'after birth', 'after delivery', 'ppd', 'baby blues'],
            'anxiety': ['anxious', 'anxiety', 'worried', 'worry', 'panic', 'fear'],
            'depression': ['depressed', 'depression', 'sad', 'hopeless', 'empty'],
            'sleep': ['sleep', 'insomnia', 'tired', 'exhausted', 'can\'t sleep'],
            'stress': ['stress', 'overwhelmed', 'too much', 'can\'t cope'],
            'relationship': ['partner', 'husband', 'relationship', 'marriage', 'spouse'],
            'identity': ['lost myself', 'who am i', 'identity', 'not myself'],
            'bonding': ['bond', 'bonding', 'connect', 'love my baby']
        };

        for (const [topic, keywords] of Object.entries(topics)) {
            if (keywords.some(kw => lowerMessage.includes(kw))) {
                return topic;
            }
        }

        return 'general';
    }

    /**
     * Add relevant self-care suggestions based on topic
     */
    addSelfCareSuggestions(response, message) {
        const topic = this.identifyTopic(message);

        const suggestions = {
            'sleep': '\n\n💤 **Quick tip:** Try a short relaxation exercise before bed - even 5 minutes of deep breathing can help.',
            'anxiety': '\n\n🌬️ **Grounding exercise:** Try the 5-4-3-2-1 technique: Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.',
            'stress': '\n\n🧘 **Self-care reminder:** Even 10 minutes of "me time" can make a difference. You deserve rest too.',
            'postpartum_depression': '\n\n💜 **Remember:** What you\'re feeling is more common than you think. 1 in 7 mothers experience PPD. You\'re not alone.',
        };

        if (suggestions[topic] && !response.includes('tip') && !response.includes('exercise')) {
            return response + suggestions[topic];
        }

        return response;
    }

    /**
     * Fallback response when API fails
     */
    getFallbackResponse() {
        return {
            text: `I'm here to listen and support you. While I'm having a small technical issue, I want you to know that your feelings are valid.

Here are some things that might help right now:
• Take a few deep breaths
• If possible, step outside for some fresh air
• Reach out to someone you trust
• Be gentle with yourself

Would you like to try sharing what's on your mind again?`,
            agentType: this.agentType,
            metadata: {
                fallback: true
            }
        };
    }
}

module.exports = new MentalHealthAgent();
