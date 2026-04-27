/**
 * Base Orchestrator Agent
 * Routes user messages to appropriate specialized agents
 * Uses multi-signal confidence-weighted intent classification
 */

const geminiClient = require('./tools/geminiClient');
const sessionManager = require('./sessionManager');
const config = require('./config');
const appTools = require('./tools/appTools');

// Import specialized agents
const emergencyAgent = require('./agents/emergencyAgent');
const hospitalAgent = require('./agents/hospitalAgent');
const mentalHealthAgent = require('./agents/mentalHealthAgent');
const homeRemedyAgent = require('./agents/homeRemedyAgent');

class Orchestrator {
    constructor() {
        this.agents = {
            emergency: emergencyAgent,
            hospital: hospitalAgent,
            mental_health: mentalHealthAgent,
            home_remedy: homeRemedyAgent
        };

        this.intentToAgent = {
            'EMERGENCY': 'emergency',
            'HOSPITAL_SEARCH': 'hospital',
            'MENTAL_HEALTH': 'mental_health',
            'HOME_REMEDY': 'home_remedy',
            'APP_NAVIGATION': null,  // Handled by appTools
            'GREETING': null,  // Handled directly by orchestrator
            'GENERAL': null // Handled directly by orchestrator
        };
    }

    /**
     * Process a user message through the orchestration pipeline
     * @param {string} message - User's message
     * @param {string} userId - User's MongoDB ID
     * @param {Object} options - Additional options (location, etc.)
     * @returns {Object} Response from appropriate agent
     */
    async processMessage(message, userId, options = {}) {
        const startTime = Date.now();

        try {
            // Input sanitization
            message = this.sanitizeInput(message);

            // Guard against empty message after sanitization
            if (!message) {
                return {
                    success: true,
                    message: "I didn't catch that. Could you try again? 😊",
                    agentType: 'orchestrator',
                    actions: [],
                    quickReplies: this.getQuickReplies('greeting')
                };
            }

            // Get or create session
            const session = await sessionManager.getOrCreateSession(userId);

            // Update location if provided
            if (options.latitude && options.longitude) {
                await sessionManager.updateLocation(session._id, options.latitude, options.longitude);
                session.metadata.location = {
                    latitude: options.latitude,
                    longitude: options.longitude,
                    lastUpdated: new Date()
                };
            }

            // Save user message
            const userMessage = await sessionManager.saveMessage({
                sessionId: session._id,
                userId,
                role: 'user',
                content: message,
                agentType: 'orchestrator'
            });

            // Update context with user message
            await sessionManager.updateContext(session._id, {
                role: 'user',
                content: message,
                agentType: 'orchestrator'
            });

            // Get formatted context for agents
            const context = await sessionManager.getFormattedContext(session._id);

            // Load memory context (if memory manager is available)
            let memoryContext = '';
            try {
                const memoryManager = require('./memoryManager');
                memoryContext = await memoryManager.getMemoryContext(userId);
            } catch (e) {
                // memoryManager not yet available, that's ok
            }

            // IMPORTANT: Check for call confirmation (emergency auto-call)
            let intent;
            let confidence = 100;
            let agent;

            if (session.metadata?.awaitingCallConfirmation) {
                const lowerMsg = message.toLowerCase().trim();
                const confirmPhrases = ['yes', 'call them', 'please call', 'yes call', 'do it', 'call my', 'yes please', 'go ahead'];
                const denyPhrases = ['no', 'don\'t call', 'no thanks', 'nevermind', 'never mind', 'cancel'];

                const isConfirm = confirmPhrases.some(p => lowerMsg.includes(p));
                const isDeny = denyPhrases.some(p => lowerMsg.includes(p));

                if (isConfirm && !isDeny) {
                    // User confirmed — place the call
                    console.log('[Orchestrator] Call confirmation received');
                    session.metadata.awaitingCallConfirmation = false;
                    await sessionManager.updateMetadata(session._id, {
                        'metadata.awaitingCallConfirmation': false
                    }).catch(() => { });

                    const callResponse = await this.agents.emergency.handleCallConfirmation(userId, message, session);

                    // Save and return
                    const assistantMsg = await sessionManager.saveMessage({
                        sessionId: session._id, userId, role: 'assistant',
                        content: callResponse.text, agentType: callResponse.agentType,
                        metadata: callResponse.metadata, parentMessageId: userMessage._id
                    });
                    await sessionManager.updateContext(session._id, {
                        role: 'assistant', content: callResponse.text, agentType: callResponse.agentType
                    });

                    return {
                        success: true, message: callResponse.text, messageId: assistantMsg._id,
                        sessionId: session._id, agentType: callResponse.agentType,
                        quickReplies: this.getQuickReplies('emergency'),
                        metadata: { ...callResponse.metadata, responseTimeMs: Date.now() - startTime }
                    };
                } else {
                    // User declined or said something else — clear flag, proceed normally
                    session.metadata.awaitingCallConfirmation = false;
                    await sessionManager.updateMetadata(session._id, {
                        'metadata.awaitingCallConfirmation': false
                    }).catch(() => { });
                }
            }

            // Check for active assessment - bypass normal intent classification
            if (session.metadata?.assessmentState?.isActive) {
                // Check for escape/cancel keywords or crisis messages
                const lowerMessage = message.toLowerCase().trim();
                const escapeKeywords = ['stop', 'cancel', 'never mind', 'nevermind', 'quit', 'exit', 'end assessment', 'skip'];
                const isEscape = escapeKeywords.some(keyword => lowerMessage.includes(keyword));
                const isCrisis = geminiClient.quickCrisisCheck(message);

                if (isEscape || isCrisis) {
                    // Reset assessment state and classify normally
                    console.log(`[Orchestrator] Assessment cancelled (escape=${isEscape}, crisis=${isCrisis})`);
                    session.metadata.assessmentState.isActive = false;
                    await sessionManager.updateMetadata(session._id, {
                        'metadata.assessmentState.isActive': false
                    }).catch(() => { }); // Best-effort persist

                    const classification = await this.classifyIntent(message, session);
                    intent = classification.intent;
                    confidence = classification.confidence;
                    console.log(`[Orchestrator] Post-escape intent: ${intent} (${confidence}%)`);
                    const agentName = this.intentToAgent[intent];
                    agent = agentName ? this.agents[agentName] : null;
                } else {
                    // Active assessment in progress - route to the stored agent
                    const assessmentAgent = session.metadata.assessmentState.agentType || 'home_remedy';
                    console.log(`[Orchestrator] Active assessment detected, routing to ${assessmentAgent}`);
                    intent = assessmentAgent === 'home_remedy' ? 'HOME_REMEDY' : 'MENTAL_HEALTH';
                    agent = this.agents[assessmentAgent];
                }
            } else {
                // Normal intent classification with confidence scoring
                const classification = await this.classifyIntent(message, session);
                intent = classification.intent;
                confidence = classification.confidence;
                console.log(`[Orchestrator] Intent: ${intent} (${confidence}%) for: "${message.substring(0, 50)}..."`);
                const agentName = this.intentToAgent[intent];
                agent = agentName ? this.agents[agentName] : null;
            }

            let response;

            // ─── Agent switch announcement ───
            const previousAgent = session.metadata?.lastAgentType;
            const currentAgentType = agent ? Object.keys(this.agents).find(k => this.agents[k] === agent) : null;
            const agentSwitched = previousAgent && currentAgentType && previousAgent !== currentAgentType
                && previousAgent !== 'orchestrator';

            const agentFriendlyNames = {
                emergency: '🆘 crisis support',
                hospital: '🏥 hospital finder',
                mental_health: '💚 emotional support',
                home_remedy: '🌿 home remedy advisor'
            };

            // Handle GREETING intent directly (no specialized agent needed)
            if (intent === 'GREETING' && !agent) {
                response = await this.handleGreeting(message, context, session, memoryContext);
            } else if (intent === 'APP_NAVIGATION') {
                // Handle app navigation with appTools
                response = await this.handleAppNavigation(message, userId);
            } else if (intent === 'GENERAL' && !agent) {
                // Handle general queries directly
                response = await this.handleGeneral(message, context, session, memoryContext);
            } else if (confidence < 40 && intent !== 'EMERGENCY') {
                // Low confidence — ask for clarification instead of guessing
                response = this.handleAmbiguous(message, intent);
            } else if (confidence >= 40 && confidence <= 65 && intent !== 'EMERGENCY') {
                // Medium confidence — ask user to disambiguate
                const agentLabel = agentFriendlyNames[currentAgentType] || intent.toLowerCase();
                response = {
                    text: `I want to make sure I understand you correctly. Did you mean to ask about **${agentLabel}**? Or is there something else I can help with?\n\nYou can also tell me:\n• "Find a hospital" 🏥\n• "Home remedy for..." 🌿\n• "I'm feeling..." 💚\n• "Help" for more options`,
                    agentType: 'orchestrator',
                    metadata: { disambiguation: true, suggestedIntent: intent, confidence }
                };
            } else {
                // Inject memory context into agent's system prompt (not as fake messages)
                let enrichedContext = context;
                if (memoryContext && agent && agent.systemPrompt) {
                    // Temporarily enhance the agent's system prompt with user context
                    const originalPrompt = agent.systemPrompt;
                    agent.systemPrompt = `${originalPrompt}\n\n[User context: ${memoryContext}]`;
                    response = await agent.process(message, enrichedContext, session);
                    agent.systemPrompt = originalPrompt; // Restore
                } else {
                    response = await agent.process(message, enrichedContext, session);
                }

                // Prepend agent switch announcement if agent changed
                if (agentSwitched && response.text) {
                    const friendlyName = agentFriendlyNames[currentAgentType] || currentAgentType;
                    response.text = `*Connecting you with ${friendlyName}...*\n\n${response.text}`;
                }
            }

            // Handle escalation (e.g., mental health agent detecting crisis)
            if (response.escalate) {
                const escalateAgent = this.agents[response.escalateTo];
                if (escalateAgent) {
                    const escalateName = agentFriendlyNames[response.escalateTo] || response.escalateTo;
                    let escalatedResponse = await escalateAgent.process(message, context, session);
                    escalatedResponse.text = `*Connecting you with ${escalateName}...*\n\n${escalatedResponse.text}`;
                    response = escalatedResponse;
                } else {
                    console.error(`[Orchestrator] Unknown escalation target: ${response.escalateTo}`);
                    // Fall through with original response text if available
                    if (!response.text) {
                        response = this.handleAmbiguous(message, intent);
                    }
                }
            }

            // Add quick-reply suggestions
            const quickReplies = this.getQuickReplies(response.agentType || intent.toLowerCase());

            // Persist call confirmation flag from emergency agent
            if (response.metadata?.awaitingCallConfirmation) {
                await sessionManager.updateMetadata(session._id, {
                    'metadata.awaitingCallConfirmation': true
                }).catch(() => { });
            }

            // Save assistant response (persist actions in metadata for history replay)
            const assistantMessage = await sessionManager.saveMessage({
                sessionId: session._id,
                userId,
                role: 'assistant',
                content: response.text,
                agentType: response.agentType,
                metadata: {
                    ...response.metadata,
                    actions: response.actions || [],
                    responseTimeMs: Date.now() - startTime,
                    intentClassification: intent,
                    intentConfidence: confidence
                },
                parentMessageId: userMessage._id
            });

            // Update context with assistant message
            await sessionManager.updateContext(session._id, {
                role: 'assistant',
                content: response.text,
                agentType: response.agentType
            });

            // Background: update memory (non-blocking)
            this.updateMemoryBackground(userId, message, response.text, response.agentType);

            return {
                success: true,
                message: response.text,
                messageId: assistantMessage._id,
                sessionId: session._id,
                agentType: response.agentType,
                quickReplies: quickReplies,
                actions: response.actions || [],
                metadata: {
                    ...response.metadata,
                    intent,
                    confidence,
                    responseTimeMs: Date.now() - startTime
                }
            };
        } catch (error) {
            console.error('[Orchestrator] Error:', error);

            return {
                success: false,
                message: 'Oh no, I\'m having a small hiccup processing your message. 😊 Could you try sending it again? I\'m here for you!',
                error: error.message,
                agentType: 'orchestrator'
            };
        }
    }

    /**
     * Sanitize user input
     */
    sanitizeInput(message) {
        if (!message || typeof message !== 'string') return '';
        // Strip HTML tags
        let clean = message.replace(/<[^>]*>/g, '');
        // Remove null bytes
        clean = clean.replace(/\0/g, '');
        // Trim and limit length
        return clean.trim().slice(0, 2000);
    }

    /**
     * AI-first intent classification with keyword safety net
     * Primary: Gemini AI classification with structured JSON output
     * Safety net: Crisis keywords (zero-latency, no API needed)
     * Fallback: Weighted keyword scoring (if Gemini fails)
     * @param {string} message - User's message
     * @param {Object} session - Current session
     * @returns {Object} { intent: string, confidence: number }
     */
    async classifyIntent(message, session) {
        const lowerMessage = message.toLowerCase().trim();

        // ═══ PRIORITY 1: Crisis keyword check (safety-critical, zero-latency) ═══
        if (geminiClient.quickCrisisCheck(message)) {
            return { intent: 'EMERGENCY', confidence: 95 };
        }

        // ═══ PRIORITY 2: Short greetings (obvious, no API call needed) ═══
        if (lowerMessage.length < 15 && this.isLikelyGreeting(lowerMessage)) {
            return { intent: 'GREETING', confidence: 90 };
        }

        // ═══ PRIORITY 3: Gemini AI classification (primary classifier) ═══
        let geminiResult = null;
        try {
            geminiResult = await geminiClient.classifyIntent(message);
            console.log(`[Orchestrator] Gemini classified: ${geminiResult.intent} (${geminiResult.confidence}%)`);
        } catch (error) {
            console.error('[Orchestrator] Gemini classification failed, falling back to keywords:', error.message);
        }

        // ═══ PRIORITY 4: Keyword scoring (validation + fallback) ═══
        const keywordScores = this.scoreAllIntents(lowerMessage);
        const sortedKeywords = Object.entries(keywordScores)
            .sort(([, a], [, b]) => b - a)
            .filter(([, score]) => score > 0);

        // ═══ PRIORITY 5: Context boost for follow-up messages ═══
        const contextBoost = this.getContextBoost(lowerMessage, session);

        // ═══ DECISION LOGIC ═══

        // Case 1: Gemini succeeded
        if (geminiResult && geminiResult.intent !== 'GENERAL') {
            // Validate against keyword signals
            if (sortedKeywords.length > 0) {
                const [topKeywordIntent, topKeywordScore] = sortedKeywords[0];
                const keywordConfig = config.weightedKeywords[topKeywordIntent];
                const threshold = keywordConfig?.threshold || 2;
                const strongKeywordMatch = topKeywordScore >= threshold * 2; // Very strong keyword signal

                // If keywords strongly disagree with Gemini, and keyword signal is very strong, prefer keywords
                if (strongKeywordMatch && topKeywordIntent !== geminiResult.intent && topKeywordIntent === 'EMERGENCY') {
                    console.log(`[Orchestrator] Keyword override: EMERGENCY safety net triggered (keyword score ${topKeywordScore})`);
                    return { intent: 'EMERGENCY', confidence: 90 };
                }

                // Log disagreements for debugging, but trust Gemini
                if (strongKeywordMatch && topKeywordIntent !== geminiResult.intent) {
                    console.log(`[Orchestrator] Note: Gemini(${geminiResult.intent}) vs Keywords(${topKeywordIntent}:${topKeywordScore}) — trusting Gemini`);
                }
            }

            // Apply context boost if applicable
            if (contextBoost && contextBoost.intent === geminiResult.intent) {
                geminiResult.confidence = Math.min(100, geminiResult.confidence + 10);
            }

            return geminiResult;
        }

        // Case 2: Gemini returned GENERAL or failed — use keyword scoring
        if (sortedKeywords.length > 0) {
            const [topIntent, topScore] = sortedKeywords[0];
            const weightedConfig = config.weightedKeywords[topIntent];
            const threshold = weightedConfig?.threshold || 2;

            if (topScore >= threshold) {
                // Apply context boost
                let finalScore = topScore;
                if (contextBoost && contextBoost.intent === topIntent) {
                    finalScore += contextBoost.boost;
                }

                const confidence = Math.min(85, Math.round((finalScore / (threshold * 2)) * 100));
                console.log(`[Orchestrator] Keyword fallback: ${topIntent} (score ${topScore}, confidence ${confidence}%)`);
                return { intent: topIntent, confidence };
            }
        }

        // Case 3: Context boost only (follow-up to previous conversation)
        if (contextBoost) {
            return { intent: contextBoost.intent, confidence: 55 };
        }

        // Case 4: Nothing matched — default to GENERAL (not GREETING)
        return { intent: 'GENERAL', confidence: 40 };
    }

    /**
     * Get a random response style directive to inject into prompts
     * Prevents repetitive tone by varying personality each message
     * @returns {string} A style directive string
     */
    getRandomStyleDirective() {
        const directives = config.responseStyleDirectives || [
            'Be warm and encouraging like a supportive best friend.',
            'Be gently playful — use light humor and fun metaphors.',
            'Be nurturing and wise, like a caring elder sister (didi).',
            'Be cheerful and energetic — use vivid, colorful language.',
            'Be calm and soothing — like a warm cup of chai on a rainy day.',
            'Be encouraging and uplifting — celebrate small wins.',
            'Be casual and relatable — like chatting with a friend over tea.',
            'Be dynamic and expressive — use creative analogies.'
        ];
        return directives[Math.floor(Math.random() * directives.length)];
    }

    /**
     * Score all intents using weighted keyword matching
     * @param {string} lowerMessage - Lowercased user message
     * @returns {Object} Map of intent -> total score
     */
    scoreAllIntents(lowerMessage) {
        const scores = {};

        for (const [intent, intentConfig] of Object.entries(config.weightedKeywords)) {
            let totalScore = 0;
            let hasNegator = false;

            // Check negators first
            if (intentConfig.negators) {
                hasNegator = intentConfig.negators.some(neg => lowerMessage.includes(neg));
            }

            if (hasNegator) {
                // Negator found — suppress this intent
                scores[intent] = 0;
                continue;
            }

            // Score keywords
            for (const kw of intentConfig.keywords) {
                if (lowerMessage.includes(kw.phrase)) {
                    totalScore += kw.weight;
                }
            }

            scores[intent] = totalScore;
        }

        return scores;
    }

    /**
     * Get context boost for follow-up messages
     * @param {string} lowerMessage - Lowercased message
     * @param {Object} session - Current session
     * @returns {Object|null} { intent, boost } or null
     */
    getContextBoost(lowerMessage, session) {
        if (!session?.metadata?.lastAgentType) return null;

        // Only boost for genuine follow-up phrases, not single-word matches
        const followUpPhrases = [
            'tell me more', 'show me more', 'what else', 'any other',
            'more options', 'another one', 'continue', 'go on',
            'yes please', 'sounds good', 'okay great'
        ];

        const isFollowUp = followUpPhrases.some(phrase => lowerMessage.includes(phrase));
        if (!isFollowUp) return null;

        const agentToIntent = {
            'hospital': 'HOSPITAL_SEARCH',
            'home_remedy': 'HOME_REMEDY',
            'mental_health': 'MENTAL_HEALTH',
            'emergency': 'MENTAL_HEALTH', // Don't auto-route back to emergency
            'app_navigation': 'APP_NAVIGATION',
            'orchestrator': 'GREETING'
        };

        const intent = agentToIntent[session.metadata.lastAgentType];
        if (!intent) return null;

        return { intent, boost: 2 };
    }

    /**
     * Check if a short message is likely a greeting
     */
    isLikelyGreeting(lowerMessage) {
        const greetings = [
            'hi', 'hey', 'hello', 'hola', 'howdy',
            'good morning', 'good afternoon', 'good evening',
            'thanks', 'thank you', 'bye', 'goodbye', 'ok', 'okay',
            'yo', 'sup', 'what\'s up', 'how are you'
        ];
        return greetings.some(g => lowerMessage.includes(g));
    }

    /**
     * Handle greeting intent directly
     */
    async handleGreeting(message, context, session, memoryContext) {
        try {
            let greetingPrompt = message;
            if (memoryContext) {
                greetingPrompt = `[User info: ${memoryContext}]\n\nUser says: ${message}`;
            }

            // Inject random style directive for variety
            const styleDirective = this.getRandomStyleDirective();
            const enhancedPrompt = `${config.systemPrompts.greeting}\n\nSTYLE FOR THIS RESPONSE: ${styleDirective}`;

            const response = await geminiClient.generateResponse(
                greetingPrompt,
                enhancedPrompt,
                context.slice(-4) // Only last 4 messages for greetings
            );

            return {
                text: response.text,
                agentType: 'orchestrator',
                metadata: {
                    ...response.metadata,
                    isGreeting: true,
                    styleDirective
                }
            };
        } catch (error) {
            // Friendly fallback — randomized too
            const fallbacks = [
                'Hi there! 😊 I\'m so glad you\'re here. I\'m MomConnect AI — your maternal health companion. How can I help you today?',
                'Hey! 🌟 Welcome to MomConnect! I\'m here to help with health tips, emotional support, or finding hospitals nearby. What do you need?',
                'Hello, lovely! 💛 I\'m MomConnect AI. Whether it\'s health questions, remedies, or just someone to talk to — I\'m here. What\'s on your mind?',
                'Hi! ✨ So happy you stopped by! I\'m your MomConnect buddy. Ask me anything about pregnancy, health, or wellbeing!'
            ];
            return {
                text: fallbacks[Math.floor(Math.random() * fallbacks.length)],
                agentType: 'orchestrator',
                metadata: { fallback: true, isGreeting: true }
            };
        }
    }

    /**
     * Handle ambiguous intent — ask for clarification
     */
    handleAmbiguous(message, bestGuess) {
        return {
            text: `I want to make sure I help you in the best way! 😊 Could you tell me a bit more about what you need?\n\nI can help with:\n• 💚 **Emotional support** — feelings, stress, anxiety\n• 🌿 **Home remedies** — safe treatments for symptoms\n• 🏥 **Find hospitals** — healthcare facilities nearby\n• 🆘 **Crisis support** — immediate help\n• 🔍 **Find people, posts, groups** — search the app\n• 🧭 **Navigate** — go to any page\n\nWhat would be most helpful for you right now?`,
            agentType: 'orchestrator',
            metadata: {
                disambiguated: true,
                bestGuessIntent: bestGuess
            }
        };
    }

    /**
     * Handle GENERAL intent — answer general queries using Gemini
     */
    async handleGeneral(message, context, session, memoryContext) {
        try {
            let prompt = message;
            if (memoryContext) {
                prompt = `[User info: ${memoryContext}]\n\nUser says: ${message}`;
            }

            const styleDirective = this.getRandomStyleDirective();
            const systemPrompt = `You are MomConnect AI, a warm and friendly maternal health companion built for mothers in India.

You are having a conversation with a user. Answer their question helpfully within the scope of maternal health and wellbeing. If the question is completely outside your scope (e.g., math, weather), briefly acknowledge it and gently redirect to what you can help with.

MULTI-LANGUAGE SUPPORT: If the user writes in Hindi, reply in Hindi. If Hinglish, reply in Hinglish. Match the user's language naturally.

STYLE FOR THIS RESPONSE: ${styleDirective}`;

            const response = await geminiClient.generateResponse(
                prompt,
                systemPrompt,
                context.slice(-6)
            );

            return {
                text: response.text,
                agentType: 'orchestrator',
                metadata: {
                    ...response.metadata,
                    isGeneral: true,
                    styleDirective
                }
            };
        } catch (error) {
            return {
                text: 'I\'m your MomConnect AI companion! 😊 I can help with:\n\n• 💚 **Emotional support** — stress, anxiety, feelings\n• 🌿 **Home remedies** — safe treatments during pregnancy\n• 🏥 **Find hospitals** — healthcare facilities nearby\n• 🆘 **Crisis support** — immediate help\n\nWhat would you like to know?',
                agentType: 'orchestrator',
                metadata: { fallback: true, isGeneral: true }
            };
        }
    }

    /**
     * Handle APP_NAVIGATION intent
     * Uses Gemini to classify sub-intent then dispatches to appTools
     */
    async handleAppNavigation(message, userId) {
        try {
            // Use Gemini to extract sub-intent and parameters
            const subIntentPrompt = `You are a JSON-only classifier. Given the user message, determine the sub-intent and extract parameters.

Sub-intents:
- search_user: User wants to find/search for a specific person. Extract "query" (the name or search term).
- suggested_users: User wants people recommendations / who to follow.
- my_profile: User wants to see their own profile info, stats, follower count.
- my_followers: User wants to see who follows them.
- my_following: User wants to see who they follow.
- text_someone: User wants to message/text/DM a specific person. Extract "query" (the person's name). If no name given, leave query empty.
- search_posts: User wants to find posts about a topic. Extract "query" and optional "category" (general/advice/milestone/recipe/diy/health/education/fun/support/question).
- trending_posts: User wants to see trending/popular posts.
- saved_posts: User wants to see their bookmarked/saved posts.
- search_groups: User wants to find groups. Extract "query" and optional "category" (newborn/toddler/school-age/teens/single-moms/working-moms/stay-at-home/health/recipes/crafts/support/local/general).
- my_groups: User wants to see groups they belong to.
- navigate: User wants to go to a specific page. Extract "destination" (home/explore/messages/groups/create_group/edit_profile/chatbot).

Respond with ONLY valid JSON, no markdown:
{"subIntent": "...", "params": {"query": "...", "category": "...", "destination": "..."}}

User message: "${message}"`;

            let subIntent = 'navigate';
            let params = {};

            try {
                const geminiResult = await geminiClient.generateResponse(
                    subIntentPrompt,
                    'You are a JSON-only classifier. Return only valid JSON.',
                    []
                );

                // generateResponse returns {text, metadata} — extract text
                const rawText = geminiResult?.text || '';
                // Parse Gemini response
                const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const parsed = JSON.parse(cleaned);
                subIntent = parsed.subIntent || 'navigate';
                params = parsed.params || {};
            } catch (parseErr) {
                console.error('[Orchestrator] Sub-intent parse error:', parseErr.message);
                // Fallback: simple keyword matching
                const lower = message.toLowerCase();
                if (lower.includes('find') || lower.includes('search') || lower.includes('look for')) {
                    // Determine if it's a user, post, or group search
                    if (lower.includes('group')) {
                        subIntent = 'search_groups';
                        params.query = message.replace(/find|search|look for|groups?|about/gi, '').trim();
                    } else if (lower.includes('post')) {
                        subIntent = 'search_posts';
                        params.query = message.replace(/find|search|look for|posts?|about/gi, '').trim();
                    } else {
                        subIntent = 'search_user';
                        params.query = message.replace(/find|search|look for|user|people|person/gi, '').trim();
                    }
                } else if (lower.includes('my profile') || lower.includes('my info') || lower.includes('my stats')) {
                    subIntent = 'my_profile';
                } else if (lower.includes('follower')) {
                    subIntent = 'my_followers';
                } else if (lower.includes('following') || lower.includes('i follow')) {
                    subIntent = 'my_following';
                } else if (lower.includes('text') || lower.includes('message someone') || lower.includes('dm')) {
                    subIntent = 'text_someone';
                } else if (lower.includes('trending') || lower.includes('popular')) {
                    subIntent = 'trending_posts';
                } else if (lower.includes('saved') || lower.includes('bookmark')) {
                    subIntent = 'saved_posts';
                } else if (lower.includes('my group')) {
                    subIntent = 'my_groups';
                } else if (lower.includes('suggest') || lower.includes('recommend') || lower.includes('who should i follow')) {
                    subIntent = 'suggested_users';
                }
            }

            console.log(`[Orchestrator] APP_NAVIGATION sub-intent: ${subIntent}, params:`, params);

            // Dispatch to appTools
            const toolResult = await appTools.handleAction(subIntent, params, userId);

            return {
                text: toolResult.text,
                actions: toolResult.actions || [],
                agentType: 'app_navigation',
                metadata: { subIntent, params }
            };
        } catch (error) {
            console.error('[Orchestrator] handleAppNavigation error:', error);
            return {
                text: 'I can help you navigate the app! Try saying things like "Find user Priya", "Show trending posts", or "Take me to messages" 😊',
                actions: appTools.getNavLinks().actions,
                agentType: 'app_navigation',
                metadata: { error: error.message }
            };
        }
    }

    /**
     * Get quick-reply suggestions based on agent type
     */
    getQuickReplies(agentType) {
        return config.quickReplies[agentType] || config.quickReplies.greeting || [];
    }

    /**
     * Background memory update (fire and forget)
     */
    updateMemoryBackground(userId, userMessage, botResponse, agentType) {
        // Run in background, don't await
        setImmediate(async () => {
            try {
                const memoryManager = require('./memoryManager');
                await memoryManager.updateFromConversation(userId, userMessage, botResponse, agentType);
            } catch (e) {
                // Memory update is non-critical, fail silently
            }
        });
    }

    /**
     * Get chat history for a user
     * @param {string} userId - User's MongoDB ID
     * @param {number} limit - Maximum messages
     * @returns {Array} Chat messages
     */
    async getHistory(userId, limit = 50) {
        const session = await sessionManager.getSession(userId);
        if (!session) {
            return [];
        }
        return sessionManager.getHistory(session._id, limit);
    }

    /**
     * Clear conversation context (start fresh)
     * @param {string} userId - User's MongoDB ID
     */
    async clearContext(userId) {
        const session = await sessionManager.getSession(userId);
        if (session) {
            await sessionManager.clearContext(session._id);
        }
    }

    /**
     * End a user's session
     * @param {string} userId - User's MongoDB ID
     */
    async endSession(userId) {
        const session = await sessionManager.getSession(userId);
        if (session) {
            // episodic summary is already handled by sessionManager.endSession
            await sessionManager.endSession(session._id);
            // Delete all chat messages for this session so they don't reappear
            try {
                const ChatMessage = require('../models/ChatMessage');
                await ChatMessage.deleteMany({ sessionId: session._id });
            } catch (e) {
                console.error('[Orchestrator] Failed to delete messages:', e.message);
            }
        }
    }

    /**
     * Get current session info
     * @param {string} userId - User's MongoDB ID
     */
    async getSessionInfo(userId) {
        const session = await sessionManager.getSession(userId);
        if (!session) {
            return null;
        }

        return {
            sessionId: session._id,
            createdAt: session.createdAt,
            lastActive: session.lastActive,
            messageCount: session.context.length,
            lastAgentType: session.metadata.lastAgentType,
            hasLocation: !!session.metadata.location?.latitude
        };
    }

    /**
     * Health check for chatbot system
     */
    async healthCheck() {
        const geminiAvailable = geminiClient.isAvailable();
        let twilioStatus = false;
        let placesStatus = false;

        try {
            const twilioClient = require('./tools/twilioClient');
            twilioStatus = twilioClient.isAvailable();
        } catch (e) { /* */ }

        try {
            const placesClient = require('./tools/placesClient');
            placesStatus = placesClient.isAvailable();
        } catch (e) { /* */ }

        const allHealthy = geminiAvailable && twilioStatus && placesStatus;

        return {
            status: allHealthy ? 'healthy' : geminiAvailable ? 'degraded' : 'unhealthy',
            services: {
                gemini: geminiAvailable,
                twilio: twilioStatus,
                places: placesStatus,
                database: true
            }
        };
    }
}

module.exports = new Orchestrator();
