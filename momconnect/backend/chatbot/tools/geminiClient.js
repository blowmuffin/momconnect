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
        // Cache of model instances keyed by name so fallbacks aren't rebuilt on every call
        this.modelCache = new Map();
        this.activeModelName = this.primaryModel;
        this.model = this._getModel(this.primaryModel);

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
     * Get a (cached) model instance by name, creating it on first use.
     */
    _getModel(modelName) {
        let model = this.modelCache.get(modelName);
        if (!model) {
            model = this._createModel(modelName);
            this.modelCache.set(modelName, model);
        }
        return model;
    }

    /**
     * Check if client is properly initialized
     */
    isAvailable() {
        return this.client !== null;
    }

    /**
     * Run a task across the active model and fallbacks with retry + error
     * classification. The single place that owns model-fallback policy, so all
     * callers share one correct mechanism.
     *
     * @param {(model, modelName, attempt) => Promise<any>} taskFn - performs the
     *        model-specific call and parsing; throw to trigger fallback/retry.
     * @param {Object} [opts]
     * @param {number} [opts.maxRetries=3] - in-model attempts before next model
     *        (use 1 for latency-sensitive calls that should fail over immediately)
     * @param {number} [opts.baseDelay=1000] - base backoff in ms
     * @returns {Promise<any>} taskFn's resolved value
     * @throws the last error if every model is exhausted
     */
    async _executeWithModels(taskFn, { maxRetries = 3, baseDelay = 1000 } = {}) {
        const modelsToTry = [
            this.activeModelName,
            ...this.fallbackModels.filter(m => m !== this.activeModelName)
        ];
        let lastError = null;

        for (const modelName of modelsToTry) {
            const model = this._getModel(modelName);

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    const result = await taskFn(model, modelName, attempt);

                    // Success — promote this model to active for all future calls,
                    // so a dead primary stops being retried on every request.
                    if (modelName !== this.activeModelName) {
                        console.log(`[GeminiClient] Switched active model ${this.activeModelName} → ${modelName}`);
                        this.activeModelName = modelName;
                        this.model = model;
                    }
                    return result;
                } catch (error) {
                    lastError = error;

                    // Safety filter — caller-specific handling, never retry/fallback.
                    if (error.message?.includes('SAFETY')) {
                        throw error;
                    }

                    // Model unavailable (404/503) — abandon this model immediately.
                    if (error.status === 404 || error.status === 503) {
                        console.warn(`[GeminiClient] Model ${modelName} unavailable (${error.status}), trying next...`);
                        break;
                    }

                    const isRateLimit = error.message?.includes('RATE_LIMIT') || error.status === 429;
                    const isTransient = error.message?.includes('UNAVAILABLE') || error.message?.includes('INTERNAL') || error.status === 500;

                    // Per-model quota exhausted — retrying won't help, try next model.
                    if (isRateLimit && error.message?.includes('QuotaFailure')) {
                        console.warn(`[GeminiClient] Quota exhausted for ${modelName}, trying next model`);
                        break;
                    }

                    // Transient / rate-limit — exponential backoff and retry.
                    if ((isRateLimit || isTransient) && attempt < maxRetries - 1) {
                        const delay = baseDelay * Math.pow(2, attempt);
                        console.warn(`[GeminiClient] Retry ${attempt + 1}/${maxRetries} after ${delay}ms — ${error.message}`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }

                    // Non-retryable, or retries exhausted — move to next model.
                    break;
                }
            }
        }

        throw lastError || new Error('All Gemini models failed');
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

        const taskFn = async (model, modelName, attempt) => {
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
            const chat = model.startChat({
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

            // Handle empty response (throw → retry / fallback)
            if (!text || text.trim().length === 0) {
                throw new Error('Empty response from Gemini');
            }

            return {
                text: text,
                metadata: {
                    responseTimeMs: Date.now() - startTime,
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
        };

        try {
            return await this._executeWithModels(taskFn);
        } catch (error) {
            // Safety filter — return a compassionate canned response, no retry/fallback.
            if (error.message?.includes('SAFETY')) {
                return {
                    text: 'I understand this is a sensitive topic. If you\'re going through a difficult time, please know that help is available. You can reach KIRAN helpline at 1800-599-0019 (24/7, toll-free).',
                    metadata: {
                        responseTimeMs: Date.now() - startTime,
                        error: 'SAFETY_FILTER',
                        model: this.activeModelName,
                        tokensUsed: { prompt: 0, completion: 0, total: 0 }
                    }
                };
            }

            // All models and retries failed
            console.error('[GeminiClient] All models failed. Last error:', error?.message);
            throw error;
        }
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

        // Classification is latency-sensitive: fail over to the next model
        // immediately rather than backing off (maxRetries: 1).
        try {
            return await this._executeWithModels(async (model) => {
                const result = await model.generateContent({
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
                    // Preserve a legitimate confidence of 0 (avoid `|| 70` falsy-zero bug)
                    const parsedConf = parseInt(parsed.confidence, 10);
                    const confidence = Number.isFinite(parsedConf) ? parsedConf : 70;

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

                // Model responded but yielded no valid intent — settle on GENERAL
                // (don't burn fallbacks on a successful-but-unclassifiable response).
                return { intent: 'GENERAL', confidence: 30 };
            }, { maxRetries: 1 });
        } catch (error) {
            console.error('Intent classification error: all models failed.', error?.message);
            return { intent: 'GENERAL', confidence: 0 };
        }
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

        // Non-critical operation — fail gracefully to '' if every model is exhausted.
        try {
            return await this._executeWithModels(async (model) => {
                const result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 150, temperature: 0.3 }
                });
                return result.response.text().trim();
            }, { maxRetries: 1 });
        } catch (error) {
            console.error('Conversation summarization error:', error?.message);
            return '';
        }
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

        // Non-critical operation — fail gracefully to null if every model is exhausted.
        try {
            return await this._executeWithModels(async (model) => {
                const result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 100, temperature: 0.1 }
                });

                const responseText = result.response.text().trim();
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    // Guard the parse so a malformed-but-successful response settles
                    // here instead of throwing and burning fallback models.
                    try {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (Object.keys(parsed).length > 0) {
                            return parsed;
                        }
                    } catch (_) {
                        return null;
                    }
                }
                return null;
            }, { maxRetries: 1 });
        } catch (error) {
            return null; // Non-critical, fail silently
        }
    }
}

// Export singleton instance
module.exports = new GeminiClient();
