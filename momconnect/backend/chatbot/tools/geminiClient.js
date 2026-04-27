/**
 * Gemini API Client
 * Wrapper for Google Generative AI SDK with retry logic and confidence scoring
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const CircuitBreaker = require('./circuitBreaker');

class GeminiClient {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (!this.apiKey) {
            console.warn('⚠️ GEMINI_API_KEY not set. Chatbot will not function.');
            this.client = null;
            return;
        }

        this.client = new GoogleGenerativeAI(this.apiKey);
        this.primaryModel = config.gemini.model;
        // Fallback models in case primary model is unavailable
        // Verified against ListModels API — only models that exist in v1beta
        this.fallbackModels = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'];
        this.model = this._createModel(this.primaryModel);
        this.activeModelName = this.primaryModel;

        // Circuit breaker for API calls
        this.circuitBreaker = new CircuitBreaker({
            name: 'gemini-api',
            failureThreshold: 5,
            resetTimeoutMs: 30000,
            fallback: () => ({
                text: 'I\'m experiencing some connectivity issues right now. Please try again in a moment, or if you need immediate help, please call a crisis helpline or your healthcare provider.',
                metadata: { fallback: true, circuitBreakerOpen: true }
            })
        });

        console.log(`✅ Gemini client initialized with model: ${this.primaryModel}`);
    }

    /**
     * Create a model instance
     */
    _createModel(modelName) {
        return this.client.getGenerativeModel({
            model: modelName,
            generationConfig: {
                maxOutputTokens: config.gemini.maxOutputTokens,
                temperature: config.gemini.temperature,
                topP: config.gemini.topP,
                topK: config.gemini.topK
            }
        });
    }

    /**
     * Check if client is properly initialized
     */
    isAvailable() {
        return this.client !== null;
    }

    /**
     * Generate a response using Gemini
     * @param {string} prompt - User's message
     * @param {string} systemPrompt - System instructions for the agent
     * @param {Array} history - Conversation history in Gemini format
     * @returns {Object} Response with text and metadata
     */
    async generateResponse(prompt, systemPrompt, history = []) {
        if (!this.isAvailable()) {
            throw new Error('Gemini client not initialized. Check API key.');
        }

        // Wrap the actual API call with circuit breaker
        return this.circuitBreaker.exec(
            () => this._generateResponseInternal(prompt, systemPrompt, history)
        );
    }

    /**
     * Internal response generation (wrapped by circuit breaker)
     */
    async _generateResponseInternal(prompt, systemPrompt, history = []) {

        const startTime = Date.now();
        const maxRetries = 3;
        const baseDelay = 1000; // 1 second

        // Models to try: current active + fallbacks
        const modelsToTry = [this.activeModelName, ...this.fallbackModels.filter(m => m !== this.activeModelName)];
        let lastError = null;

        for (const modelName of modelsToTry) {
            const currentModel = modelName === this.activeModelName ? this.model : this._createModel(modelName);

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    // Limit history to last 10 messages to prevent context overflow
                    const limitedHistory = Array.isArray(history) ? history.slice(-10) : [];

                    // Validate and clean history to ensure proper format
                    const cleanHistory = limitedHistory.filter(msg =>
                        msg && msg.role && msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0
                    ).map(msg => ({
                        role: msg.role === 'assistant' ? 'model' : msg.role,
                        parts: msg.parts.map(p => ({ text: String(p.text || '') }))
                    }));

                    // Ensure history alternates between user and model
                    const validHistory = [];
                    let lastRole = null;
                    for (const msg of cleanHistory) {
                        if (msg.role !== lastRole) {
                            validHistory.push(msg);
                            lastRole = msg.role;
                        }
                    }

                    // CRITICAL: Gemini API requires first message to be role 'user'
                    // Strip any leading 'model' messages that would cause API rejection
                    while (validHistory.length > 0 && validHistory[0].role !== 'user') {
                        validHistory.shift();
                    }

                    // Also strip trailing 'user' messages since we're about to send one
                    while (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
                        validHistory.pop();
                    }

                    // Start a chat with system instruction and history
                    const chat = currentModel.startChat({
                        history: validHistory,
                        generationConfig: {
                            maxOutputTokens: config.gemini.maxOutputTokens,
                            temperature: config.gemini.temperature
                        },
                        systemInstruction: {
                            parts: [{ text: systemPrompt }]
                        }
                    });

                    // Send the message and get response
                    const result = await chat.sendMessage(prompt);
                    const response = result.response;
                    const text = response.text();

                    // Handle empty response
                    if (!text || text.trim().length === 0) {
                        throw new Error('Empty response from Gemini');
                    }

                    const endTime = Date.now();

                    // If we switched models, remember it
                    if (modelName !== this.activeModelName) {
                        console.log(`[GeminiClient] Switched from ${this.activeModelName} to ${modelName}`);
                        this.activeModelName = modelName;
                        this.model = currentModel;
                    }

                    return {
                        text: text,
                        metadata: {
                            responseTimeMs: endTime - startTime,
                            model: modelName,
                            tokensUsed: {
                                prompt: response.usageMetadata?.promptTokenCount || 0,
                                completion: response.usageMetadata?.candidatesTokenCount || 0,
                                total: response.usageMetadata?.totalTokenCount || 0
                            },
                            finishReason: response.candidates?.[0]?.finishReason || 'STOP',
                            retryAttempt: attempt
                        }
                    };
                } catch (error) {
                    lastError = error;

                    // Handle safety filter — don't retry, don't try other models
                    if (error.message?.includes('SAFETY')) {
                        return {
                            text: 'I understand this is a sensitive topic. If you\'re going through a difficult time, please know that help is available. You can reach KIRAN helpline at 1800-599-0019 (24/7, toll-free).',
                            metadata: {
                                responseTimeMs: Date.now() - startTime,
                                error: 'SAFETY_FILTER',
                                model: modelName,
                                tokensUsed: { prompt: 0, completion: 0, total: 0 }
                            }
                        };
                    }

                    // Model not found (404) or unavailable (503) — try next model
                    const isModelError = error.status === 404 || error.status === 503;
                    if (isModelError) {
                        console.warn(`[GeminiClient] Model ${modelName} unavailable (${error.status}), trying next...`);
                        break; // Break retry loop, try next model
                    }

                    // Retryable errors: rate limit and transient
                    const isRateLimit = error.message?.includes('RATE_LIMIT') || error.status === 429;
                    const isTransient = error.message?.includes('UNAVAILABLE') || error.message?.includes('INTERNAL') || error.status === 500;

                    // If daily/per-model quota is exhausted, don't retry — try next model instead
                    const isQuotaExhausted = isRateLimit && error.message?.includes('QuotaFailure');
                    if (isQuotaExhausted) {
                        console.warn(`[GeminiClient] Quota exhausted for ${modelName}, trying next model`);
                        break; // Skip retries, try next model
                    }

                    if ((isRateLimit || isTransient) && attempt < maxRetries - 1) {
                        const delay = baseDelay * Math.pow(2, attempt);
                        console.warn(`[GeminiClient] Retry ${attempt + 1}/${maxRetries} after ${delay}ms — ${error.message}`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }

                    // Non-retryable error on this model — try next model
                    if (attempt === maxRetries - 1) {
                        console.warn(`[GeminiClient] All retries exhausted for ${modelName}`);
                        break;
                    }
                }
            }
        }

        // All models and retries failed
        console.error('[GeminiClient] All models failed. Last error:', lastError?.message);
        throw lastError || new Error('All Gemini models failed');
    }

    /**
     * Classify intent with confidence score using structured JSON output
     * Uses few-shot examples for robust, industry-standard NLU classification
     * @param {string} message - User message to classify
     * @returns {Object} { intent: string, confidence: number (0-100) }
     */
    async classifyIntent(message) {
        if (!this.isAvailable()) {
            return { intent: 'GENERAL', confidence: 30 };
        }

        const validIntents = ['EMERGENCY', 'HOSPITAL_SEARCH', 'MENTAL_HEALTH', 'HOME_REMEDY', 'APP_NAVIGATION', 'GREETING', 'GENERAL'];

        // Build few-shot examples from config
        const examples = config.intentExamples || {};
        let fewShotBlock = '';
        for (const [intent, msgs] of Object.entries(examples)) {
            for (const msg of msgs.slice(0, 2)) { // 2 examples per intent
                fewShotBlock += `User: "${msg}" → {"intent":"${intent}","confidence":90}\n`;
            }
        }

        const classificationPrompt = `You are an intent classifier for MomConnect, a maternal health chatbot for Indian mothers.
The user may write in English, Hindi, Hinglish, Tamil, Telugu, Bengali, Marathi, or any Indian language.

Classify the following user message into EXACTLY ONE of these intents:
- EMERGENCY: Crisis, self-harm, danger to self or baby, suicidal thoughts
- HOSPITAL_SEARCH: Finding hospitals, clinics, doctors, healthcare facilities
- MENTAL_HEALTH: Emotional support, anxiety, stress, depression, loneliness, need for company
- HOME_REMEDY: Home remedies, natural treatments, pregnancy symptoms, health tips
- APP_NAVIGATION: Searching users/posts/groups, viewing profile, navigating app pages, messaging someone
- GREETING: Hello, goodbye, thanks, casual chat
- GENERAL: Unclear or doesn't fit any category

RULES:
- "stay with me", "talk to me", "I need someone" → MENTAL_HEALTH (NOT emergency)
- "find people", "search user", "show my profile", "trending posts" → APP_NAVIGATION
- Symptoms like "headache", "nausea", "back pain" → HOME_REMEDY (unless combined with crisis language)
- Pure emotional distress WITHOUT self-harm intent → MENTAL_HEALTH

Few-shot examples:
${fewShotBlock}
Respond with ONLY valid JSON (no markdown, no backticks):
{"intent":"INTENT_NAME","confidence":0-100}

User message: "${message}"`;

        // Try all models (active + fallbacks) for classification
        const modelsToTry = [this.activeModelName, ...this.fallbackModels.filter(m => m !== this.activeModelName)];
        let lastError = null;

        for (const modelName of modelsToTry) {
            try {
                const currentModel = modelName === this.activeModelName ? this.model : this._createModel(modelName);

                const result = await currentModel.generateContent({
                    contents: [{ role: 'user', parts: [{ text: classificationPrompt }] }],
                    generationConfig: {
                        maxOutputTokens: 150,
                        temperature: 0.1
                    }
                });

                const rawText = result.response.text().trim();
                // Strip markdown fences if present
                const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

                try {
                    const parsed = JSON.parse(cleaned);
                    const intent = String(parsed.intent || '').toUpperCase();
                    const confidence = parseInt(parsed.confidence) || 70;

                    if (validIntents.includes(intent)) {
                        return {
                            intent,
                            confidence: Math.min(100, Math.max(0, confidence))
                        };
                    }
                } catch (parseErr) {
                    // JSON parse failed — try to extract intent from raw text
                    const upperText = rawText.toUpperCase();
                    for (const vi of validIntents) {
                        if (upperText.includes(vi)) {
                            return { intent: vi, confidence: 60 };
                        }
                    }
                }

                return { intent: 'GENERAL', confidence: 30 };
            } catch (error) {
                lastError = error;
                // Any 429 or model error — skip to next model immediately (classification is latency-sensitive)
                if (error.status === 429 || error.status === 404 || error.status === 503) {
                    console.warn(`[GeminiClient] classifyIntent: ${modelName} unavailable (${error.status}), trying next...`);
                    continue;
                }
                // Other error — log and try next model
                console.warn(`[GeminiClient] classifyIntent failed on ${modelName}:`, error.message);
                continue;
            }
        }

        // All models failed
        console.error('Intent classification error: all models failed.', lastError?.message);
        return { intent: 'GENERAL', confidence: 0 };
    }

    /**
     * Context-aware crisis check using keywords
     * Checks for crisis keywords while filtering out negating context
     * @param {string} message - User message
     * @returns {boolean} Whether message contains genuine crisis indicators
     */
    quickCrisisCheck(message) {
        const lowerMessage = message.toLowerCase();

        // First check if any negator phrase is present — if so, the crisis keyword
        // is likely being used in a non-crisis context
        const negators = config.crisisNegators || [];
        for (const negator of negators) {
            if (lowerMessage.includes(negator)) {
                return false;
            }
        }

        return config.crisisKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    /**
     * Generate a concise summary of a conversation for episodic memory
     * @param {Array} messages - Array of {role, content} objects
     * @returns {string} Summary text
     */
    async summarizeConversation(messages) {
        if (!this.isAvailable() || !messages || messages.length === 0) {
            return '';
        }

        const conversationText = messages.map(m =>
            `${m.role === 'user' ? 'User' : 'Bot'}: ${m.content}`
        ).join('\n');

        const prompt = `Summarize this conversation in 2-3 sentences. Focus on: the user's main concerns, any health details mentioned (pregnancy stage, symptoms), and emotional state. Be concise.\n\nConversation:\n${conversationText}`;

        // Try all models (non-critical operation, fail gracefully)
        const modelsToTry = [this.activeModelName, ...this.fallbackModels.filter(m => m !== this.activeModelName)];
        for (const modelName of modelsToTry) {
            try {
                const currentModel = modelName === this.activeModelName ? this.model : this._createModel(modelName);
                const result = await currentModel.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 150, temperature: 0.3 }
                });
                return result.response.text().trim();
            } catch (error) {
                if (error.status === 429 || error.status === 404 || error.status === 503) {
                    continue; // Try next model
                }
                console.error('Conversation summarization error:', error.message);
                return '';
            }
        }
        // All models failed — non-critical, return empty
        return '';
    }

    /**
     * Extract profile information from a message
     * @param {string} message - User message
     * @returns {Object|null} Extracted profile fields or null
     */
    async extractProfileInfo(message) {
        if (!this.isAvailable()) return null;

        const prompt = `Extract any personal profile information from this message. Return ONLY a JSON object with any fields found (leave out fields not mentioned). Possible fields: name, pregnancyStage (e.g. "first_trimester", "second_trimester", "third_trimester", "postpartum"), dueDate, babyAge, conditions (array of strings).

If no profile info is found, return: {}

Message: "${message}"`;

        // Try all models (non-critical operation, fail gracefully)
        const modelsToTry = [this.activeModelName, ...this.fallbackModels.filter(m => m !== this.activeModelName)];
        for (const modelName of modelsToTry) {
            try {
                const currentModel = modelName === this.activeModelName ? this.model : this._createModel(modelName);
                const result = await currentModel.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 100, temperature: 0.1 }
                });

                const responseText = result.response.text().trim();
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (Object.keys(parsed).length > 0) {
                        return parsed;
                    }
                }
                return null;
            } catch (error) {
                if (error.status === 429 || error.status === 404 || error.status === 503) {
                    continue; // Try next model
                }
                return null; // Non-critical, fail silently
            }
        }
        return null;
    }
}

// Export singleton instance
module.exports = new GeminiClient();
