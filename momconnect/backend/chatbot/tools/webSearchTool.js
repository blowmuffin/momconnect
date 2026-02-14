/**
 * Web Search Tool for Chatbot
 * Uses DuckDuckGo API for verification of health information
 */

const https = require('https');
const http = require('http');

class WebSearchTool {
    constructor() {
        this.baseUrl = 'https://api.duckduckgo.com';
        this.cache = new Map();
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
        this.maxCacheSize = 200; // LRU cap
    }

    /**
     * Search for health information to verify recommendations
     * @param {string} query - Search query
     * @returns {Object} Search results summary
     */
    async search(query) {
        // Clean expired entries on every search
        this.cleanCache();

        // Check cache first
        const cacheKey = query.toLowerCase().trim();
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            console.log(`[WebSearch] Cache hit for: ${query}`);
            return cached.result;
        }

        try {
            console.log(`[WebSearch] Searching: ${query}`);
            const result = await this.duckDuckGoInstant(query);

            // Evict oldest entry if cache is at capacity
            if (this.cache.size >= this.maxCacheSize) {
                const oldestKey = this.cache.keys().next().value;
                this.cache.delete(oldestKey);
            }

            // Cache the result
            this.cache.set(cacheKey, {
                result,
                timestamp: Date.now()
            });

            return result;
        } catch (error) {
            console.error('[WebSearch] Error:', error.message);
            return {
                success: false,
                error: error.message,
                summary: null
            };
        }
    }

    /**
     * DuckDuckGo Instant Answer API
     */
    async duckDuckGoInstant(query) {
        return new Promise((resolve, reject) => {
            const encodedQuery = encodeURIComponent(query);
            const url = `${this.baseUrl}/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;

            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve({
                            success: true,
                            abstract: json.Abstract || null,
                            abstractSource: json.AbstractSource || null,
                            abstractURL: json.AbstractURL || null,
                            definition: json.Definition || null,
                            relatedTopics: json.RelatedTopics?.slice(0, 3).map(t => ({
                                text: t.Text,
                                url: t.FirstURL
                            })) || [],
                            image: json.Image || null
                        });
                    } catch (e) {
                        resolve({
                            success: false,
                            error: 'Failed to parse response'
                        });
                    }
                });
            }).on('error', reject);
        });
    }

    /**
     * Verify a health recommendation
     * @param {string} symptom - The symptom being treated
     * @param {string} remedy - The proposed remedy
     * @returns {Object} Verification result
     */
    async verifyRemedy(symptom, remedy) {
        const query = `${remedy} safe during pregnancy ${symptom}`;
        const result = await this.search(query);

        if (result.success && result.abstract) {
            return {
                verified: true,
                source: result.abstractSource,
                info: result.abstract,
                url: result.abstractURL
            };
        }

        return {
            verified: false,
            note: 'Could not find verification - please consult healthcare provider'
        };
    }

    /**
     * Get health topic information
     * @param {string} topic - Health topic
     * @returns {Object} Topic information
     */
    async getHealthInfo(topic) {
        const query = `${topic} pregnancy maternal health`;
        return await this.search(query);
    }

    /**
     * Clear expired cache entries
     */
    cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }
}

module.exports = new WebSearchTool();
