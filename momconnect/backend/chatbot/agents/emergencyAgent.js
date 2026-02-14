/**
 * Emergency Crisis Agent
 * Handles mental health crises with immediate, compassionate support
 * Implements 3-tier escalation: helplines → offer call → auto-call
 */

const geminiClient = require('../tools/geminiClient');
const twilioClient = require('../tools/twilioClient');
const config = require('../config');
const User = require('../../models/User');
const EmergencyLog = require('../../models/EmergencyLog');

class EmergencyAgent {
    constructor() {
        this.agentType = 'emergency';
        this.systemPrompt = config.systemPrompts.emergency;
    }

    /**
     * Process an emergency/crisis message with tiered escalation
     * @param {string} message - User's message
     * @param {Array} context - Conversation history
     * @param {Object} session - Session object with metadata
     * @returns {Object} Response with text and metadata
     */
    async process(message, context = [], session = null) {
        const userId = session?.userId || session?.metadata?.userId;
        const region = session?.metadata?.preferences?.region || 'IN';
        const helplines = this.getHelplines(region);
        const severity = await this.assessSeverity(message);

        // ─── DE-ESCALATION CHECK ───
        if (this.isDeEscalation(message)) {
            return {
                text: `I'm really glad to hear you're feeling a bit better. 💚 That takes strength.\n\nI'm still here if you want to talk, or I can help you with something else. Remember, it's always okay to reach out again if you need support.\n\n📞 Crisis helplines are always available:\n${helplines.map(h => `• **${h.name}**: ${h.number}`).join('\n')}`,
                agentType: this.agentType,
                metadata: {
                    crisisSeverity: 'DE_ESCALATED',
                    deEscalated: true,
                    helplinesProvided: helplines.map(h => h.name)
                }
            };
        }

        // Build enhanced prompt with crisis resources
        const enhancedPrompt = this.buildCrisisPrompt(message, helplines);

        let responseText;
        try {
            const response = await geminiClient.generateResponse(
                enhancedPrompt,
                this.systemPrompt,
                context
            );
            responseText = this.ensureHelplinesIncluded(response.text, helplines);
        } catch (error) {
            console.error('Emergency agent error:', error);
            const fallback = this.getFallbackResponse(helplines);
            responseText = fallback.text;
        }

        // Load emergency contact info
        const emergencyContact = await this.getEmergencyContact(userId);
        const hasContact = emergencyContact && emergencyContact.phone;

        // ─── ESCALATION — ALWAYS REQUIRE CONFIRMATION ───
        // Safety: Never auto-call. Always ask the user to confirm.
        let awaitingCallConfirmation = false;

        if ((severity === 'HIGH' || severity === 'MEDIUM') && hasContact) {
            // ═══ OFFER TO CALL — requires explicit "YES" ═══
            awaitingCallConfirmation = true;
            const urgency = severity === 'HIGH'
                ? `🚨 **I'm very concerned about your safety.** Would you like me to call your emergency contact (${emergencyContact.name}) right now? Reply **YES** to confirm.`
                : `📞 **Would you like me to call your emergency contact (${emergencyContact.name})?** Just say "yes, call them" and I'll reach out on your behalf. You don't have to go through this alone.`;
            responseText += `\n\n${urgency}`;

        } else if (!hasContact && (severity === 'HIGH' || severity === 'MEDIUM')) {
            // No emergency contact set up — gently suggest setting one up
            responseText += `\n\n💡 **Tip:** You can set up an emergency contact in the chat settings (⚠️ icon). If you ever need it, I can reach out to them on your behalf.`;
        }
        // LOW severity: Just helplines — already in responseText

        return {
            text: responseText,
            agentType: this.agentType,
            metadata: {
                crisisSeverity: severity,
                helplinesProvided: helplines.map(h => h.name),
                awaitingCallConfirmation,
                emergencyCallPlaced: false,
                emergencySMSSent: false
            }
        };
    }

    /**
     * Handle user confirming they want to call their emergency contact
     * Called when user says "yes, call them" after a MEDIUM severity offer
     * @param {string} userId - User's MongoDB ID
     * @param {string} message - Confirmation message
     * @param {Object} session - Session object
     * @returns {Object} Response
     */
    async handleCallConfirmation(userId, message, session) {
        const emergencyContact = await this.getEmergencyContact(userId);

        if (!emergencyContact || !emergencyContact.phone) {
            return {
                text: 'I don\'t have an emergency contact set up for you yet. You can add one in the chat settings (⚠️ icon). In the meantime, here are crisis helplines you can reach out to.',
                agentType: this.agentType,
                metadata: { noEmergencyContact: true }
            };
        }

        // Get the user's original crisis message from recent context
        let triggerMessage = 'Emergency situation reported';
        if (session && session.context && session.context.length > 0) {
            // Find the most recent user message that triggered the crisis (the one before "yes")
            const userMessages = session.context.filter(m => m.role === 'user' && m.content.toLowerCase() !== message.toLowerCase());
            if (userMessages.length > 0) {
                triggerMessage = userMessages[userMessages.length - 1].content.substring(0, 300);
            }
        }

        // Get the user's name for the voice/SMS message
        let userName = 'a MomConnect user';
        try {
            const User = require('../../models/User');
            const user = await User.findById(userId).select('name displayName');
            if (user) {
                userName = user.displayName || user.name || userName;
            }
        } catch (e) {
            // Non-critical
        }

        // Get the user's location from session if available
        let location = null;
        if (session && session.metadata && session.metadata.location) {
            const loc = session.metadata.location;
            if (loc.latitude && loc.longitude) {
                location = { lat: loc.latitude, lng: loc.longitude };
            }
        }

        const callOutcome = await this.triggerEmergencyCall(
            userId, emergencyContact, triggerMessage, 'HIGH', session?._id, 'user-confirmed', userName, location
        );

        if (callOutcome.called) {
            return {
                text: `✅ **Done!** I've contacted ${emergencyContact.name} by ${callOutcome.methods}. They should reach out to you soon.\n\nIn the meantime, I'm right here with you. Would you like to talk about what you're going through? 💚`,
                agentType: this.agentType,
                metadata: {
                    emergencyCallPlaced: !!callOutcome.callResult?.success,
                    emergencySMSSent: !!callOutcome.smsResult?.success,
                    triggerType: 'user-confirmed'
                }
            };
        } else if (callOutcome.cooldown) {
            return {
                text: `💛 ${emergencyContact.name} was already notified recently (within the last 30 minutes). They know you need support. I'm here with you in the meantime.`,
                agentType: this.agentType,
                metadata: { cooldownActive: true }
            };
        } else {
            return {
                text: `I tried to reach ${emergencyContact.name}, but the call didn't go through. Please try calling them directly or reach out to a crisis helpline. You deserve support right now.`,
                agentType: this.agentType,
                metadata: { callFailed: true, error: callOutcome.error }
            };
        }
    }

    /**
     * Trigger emergency call and SMS
     * @returns {Object} { called, cooldown, methods, callResult, smsResult, error }
     */
    async triggerEmergencyCall(userId, contact, triggerMessage, severity, sessionId, triggerType = 'auto', userName = null, location = null) {
        // Check cooldown
        try {
            const onCooldown = await EmergencyLog.isOnCooldown(userId, contact.phone, 2);
            if (onCooldown) {
                console.log(`[EmergencyAgent] Call blocked — cooldown active for ${contact.phone}`);

                // Log the blocked attempt
                await EmergencyLog.create({
                    userId,
                    sessionId,
                    contactName: contact.name,
                    contactPhone: contact.phone,
                    contactRelationship: contact.relationship,
                    callType: 'both',
                    severity,
                    triggerMessage: triggerMessage.substring(0, 500),
                    status: 'cooldown-blocked',
                    triggerType
                });

                return { called: false, cooldown: true };
            }
        } catch (error) {
            console.error('[EmergencyAgent] Cooldown check error:', error.message);
        }

        let callResult = null;
        let smsResult = null;
        const methods = [];

        console.log(`[EmergencyAgent] Attempting emergency notification to ${contact.name} at ${contact.phone}...`);
        console.log(`[EmergencyAgent] Twilio available: ${twilioClient.isAvailable()}, initError: ${twilioClient.initError || 'none'}`);

        // Resolve the user name if not provided
        if (!userName) {
            try {
                const User = require('../../models/User');
                const user = await User.findById(userId).select('name displayName');
                if (user) {
                    userName = user.displayName || user.name || 'a MomConnect user';
                }
            } catch (e) {
                userName = 'a MomConnect user';
            }
        }

        // Place voice call — with context about what happened
        callResult = await twilioClient.placeEmergencyCall(contact.phone, userName, {
            severity,
            relationship: contact.relationship || 'contact',
            triggerMessage,
            location
        });
        if (callResult.success) {
            methods.push('call');
            console.log(`[EmergencyAgent] ✅ Voice call placed successfully (SID: ${callResult.callSid})`);
        } else {
            console.error(`[EmergencyAgent] ❌ Voice call FAILED: ${callResult.error}`);
        }

        // Send SMS backup — also with context
        smsResult = await twilioClient.sendEmergencySMS(contact.phone, userName, {
            severity,
            triggerMessage,
            location
        });
        if (smsResult.success) {
            methods.push('SMS');
            console.log(`[EmergencyAgent] ✅ SMS sent successfully (SID: ${smsResult.messageSid})`);
        } else {
            console.error(`[EmergencyAgent] ❌ SMS FAILED: ${smsResult.error}`);
        }

        // Log to audit trail
        try {
            await EmergencyLog.create({
                userId,
                sessionId,
                contactName: contact.name,
                contactPhone: contact.phone,
                contactRelationship: contact.relationship,
                callType: methods.length > 1 ? 'both' : (methods[0] === 'call' ? 'voice' : 'sms'),
                severity,
                triggerMessage: triggerMessage.substring(0, 500),
                callSid: callResult?.callSid,
                messageSid: smsResult?.messageSid,
                status: methods.length > 0 ? 'initiated' : 'failed',
                error: methods.length === 0 ? `Call: ${callResult?.error}, SMS: ${smsResult?.error}` : undefined,
                triggerType
            });
        } catch (logError) {
            console.error('[EmergencyAgent] Failed to create emergency log:', logError.message);
        }

        if (methods.length > 0) {
            console.log(`[EmergencyAgent] Emergency notification sent via ${methods.join(' + ')} to ${contact.phone}`);
            return { called: true, methods: methods.join(' and '), callResult, smsResult };
        } else {
            return { called: false, error: callResult?.error || smsResult?.error, callResult, smsResult };
        }
    }

    /**
     * Get user's emergency contact
     * @param {string} userId - User's MongoDB ID
     * @returns {Object|null} Emergency contact details
     */
    async getEmergencyContact(userId) {
        if (!userId) return null;
        try {
            const user = await User.findById(userId).select('emergencyContact name').lean();
            if (user?.emergencyContact?.phone) {
                return {
                    ...user.emergencyContact,
                    userName: user.name
                };
            }
            return null;
        } catch (error) {
            console.error('[EmergencyAgent] Error loading emergency contact:', error.message);
            return null;
        }
    }

    /**
     * Build an enhanced prompt that includes crisis context
     */
    buildCrisisPrompt(message, helplines) {
        const helplinesText = helplines
            .map(h => `- ${h.name}: ${h.number} (${h.hours})`)
            .join('\n');

        return `The user has sent this message: "${message}"

Please provide immediate, compassionate support. After your supportive response, include these crisis helplines:

${helplinesText}

Remember to:
1. Acknowledge their feelings immediately
2. Express that you care and they matter
3. Provide grounding techniques if helpful
4. Encourage them to reach out for help`;
    }

    /**
     * Ensure helplines are included in response
     */
    ensureHelplinesIncluded(text, helplines) {
        const hasHelpline = helplines.some(h =>
            text.includes(h.number) || text.includes(h.name)
        );

        if (hasHelpline) return text;

        const helplinesSection = `\n\n📞 **Crisis Support Lines:**\n${helplines
            .map(h => `• **${h.name}**: ${h.number} (${h.hours})`)
            .join('\n')}`;

        return text + helplinesSection;
    }

    /**
     * Get helplines for a specific region
     */
    getHelplines(region) {
        return config.crisisHelplines[region] || config.crisisHelplines['DEFAULT'];
    }

    /**
     * Assess severity of crisis message
     * Includes English and Hindi/Hinglish keywords
     * Falls back to Gemini AI for nuanced language that keywords miss
     */
    async assessSeverity(message) {
        const lowerMessage = message.toLowerCase();

        const highSeverity = [
            // English — explicit self-harm / danger
            'kill myself', 'end my life', 'suicide', 'suicidal',
            'hurt my baby', 'harm my baby', 'don\'t want to live',
            'overdose', 'cutting myself', 'want to die', 'better off dead',
            'end it all', 'no point living', 'postpartum psychosis',
            'jump off', 'hang myself', 'slit my', 'take all the pills',
            'stab myself', 'drown myself', 'shoot myself',
            // Physical harm / bleeding / pain descriptions
            'bleeding', 'bleed', 'i am hurt', 'hurting myself',
            'blood everywhere', 'i cut myself', 'injured myself',
            'hurt myself', 'harming myself', 'burning myself',
            // Desperate pleas
            'please help me', 'someone help', 'i need help now',
            'save me', 'help me please', 'i can\'t breathe',
            'i\'m dying', 'dying inside', 'i am dying',
            'call someone', 'call my', 'need to call',
            // Hindi / Hinglish
            'मुझे मरना है', 'मरना चाहती हूं', 'मर जाना चाहती हूं', 'आत्महत्या',
            'जीने का मन नहीं', 'खुद को मारना', 'mar jana hai', 'marna chahti',
            'khud ko marna', 'suicide karna', 'jina nahi chahti',
            'baby ko hurt', 'apne aap ko hurt',
            'khoon', 'khun', 'chot', 'dard ho raha',
            'mujhe bachao', 'koi bachao', 'madad chahiye abhi'
        ];

        if (highSeverity.some(kw => lowerMessage.includes(kw))) {
            return 'HIGH';
        }

        const mediumSeverity = [
            // English — distress / hopelessness
            'self harm', 'can\'t go on', 'no point', 'hopeless',
            'give up', 'end it', 'not worth', 'intrusive thoughts',
            'scary thoughts', 'can\'t take it', 'don\'t want to be here',
            'i can\'t do this anymore', 'no one cares', 'nobody cares',
            'all alone', 'want to disappear', 'wish i wasn\'t here',
            'tired of living', 'tired of life', 'falling apart',
            'broken inside', 'my heart', 'can\'t stop crying',
            'emergency', 'urgent', 'crisis',
            'pain won\'t stop', 'nothing helps', 'nothing matters',
            'darkness', 'trapped', 'suffocating', 'drowning in',
            // Hindi / Hinglish
            'उम्मीद नहीं', 'हार मान', 'कोई फायदा नहीं', 'तकलीफ',
            'ummeed nahi', 'haar maan', 'koi fayda nahi', 'bahut mushkil',
            'sab khatam', 'nahi jhel sakti', 'pagal ho rahi',
            'akeli', 'koi nahi hai', 'dil toot gaya', 'bardasht nahi',
            'ro ro ke', 'rona aa raha', 'bahut dard', 'khatam karna'
        ];

        if (mediumSeverity.some(kw => lowerMessage.includes(kw))) {
            return 'MEDIUM';
        }

        // ═══ FALLBACK: Ask Gemini AI for nuanced assessment ═══
        // Keywords miss metaphorical/emotional language. Let AI assess.
        try {
            const severity = await this.geminiSeverityCheck(message);
            if (severity && severity !== 'LOW') {
                console.log(`[EmergencyAgent] Gemini severity upgrade: LOW → ${severity} for: "${message.substring(0, 50)}"`);
                return severity;
            }
        } catch (err) {
            console.error('[EmergencyAgent] Gemini severity check failed:', err.message);
        }

        return 'LOW';
    }

    /**
     * Use Gemini to assess crisis severity for messages that keywords missed
     * @param {string} message
     * @returns {string|null} 'HIGH', 'MEDIUM', or null
     */
    async geminiSeverityCheck(message) {
        try {
            const prompt = `You are a crisis severity assessor for a maternal health chatbot. Assess this message's crisis severity.

RULES:
- HIGH: Active self-harm, suicidal intent, physical danger to self or baby, requests for emergency help, descriptions of physical injury or bleeding
- MEDIUM: Hopelessness, despair, emotional breakdown, passive suicidal ideation, metaphorical pain ("bleeding from my heart", "dying inside"), desperate emotional state
- LOW: General sadness, mild stress, venting without danger indicators

Message: "${message}"

Respond with ONLY one word: HIGH, MEDIUM, or LOW`;

            const response = await geminiClient.generateResponse(prompt, 'Respond with only HIGH, MEDIUM, or LOW.', []);
            const result = response.text.trim().toUpperCase();
            if (['HIGH', 'MEDIUM'].includes(result)) {
                return result;
            }
            // Try to extract from longer response
            if (result.includes('HIGH')) return 'HIGH';
            if (result.includes('MEDIUM')) return 'MEDIUM';
            return null;
        } catch (err) {
            return null;
        }
    }

    /**
     * Check if user is de-escalating (feeling better)
     */
    isDeEscalation(message) {
        const lowerMessage = message.toLowerCase();
        const deEscalationPhrases = [
            'i\'m feeling better', 'i feel better', 'i\'m okay now', 'i\'m ok now',
            'i\'m fine now', 'not that bad', 'i\'m calmer', 'feeling calmer',
            'i\'m alright', 'it\'s not that serious', 'i was just venting',
            'i\'m better now', 'don\'t need help', 'cancel the call',
            'ab theek hoon', 'theek hun', 'thik hu', 'better feel ho raha',
            'mujhe help nahi chahiye', 'main theek hoon'
        ];
        return deEscalationPhrases.some(phrase => lowerMessage.includes(phrase));
    }

    /**
     * Fallback response when API fails
     */
    getFallbackResponse(helplines) {
        const helplinesText = helplines
            .map(h => `• **${h.name}**: ${h.number} (${h.hours})`)
            .join('\n');

        return {
            text: `I hear you, and I want you to know that what you're feeling matters. You're not alone in this.

Please reach out to someone who can help right now:

${helplinesText}

If you're in immediate danger, please call emergency services.

💙 You matter. Your feelings are valid. Help is available.`,
            agentType: this.agentType,
            metadata: {
                fallback: true,
                crisisSeverity: 'UNKNOWN'
            }
        };
    }

    /**
     * Quick check if message is a crisis
     */
    isCrisis(message) {
        return geminiClient.quickCrisisCheck(message);
    }
}

module.exports = new EmergencyAgent();
