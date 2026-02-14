/**
 * Chatbot Module Index
 * Central export point for all chatbot components
 */

const orchestrator = require('./orchestrator');
const sessionManager = require('./sessionManager');
const memoryManager = require('./memoryManager');
const config = require('./config');

// Export agents for direct access if needed
const agents = {
    emergency: require('./agents/emergencyAgent'),
    hospital: require('./agents/hospitalAgent'),
    mentalHealth: require('./agents/mentalHealthAgent'),
    homeRemedy: require('./agents/homeRemedyAgent')
};

// Export tools for testing
const tools = {
    gemini: require('./tools/geminiClient'),
    places: require('./tools/placesClient'),
    webSearch: require('./tools/webSearchTool'),
    twilio: require('./tools/twilioClient'),
    circuitBreaker: require('./tools/circuitBreaker')
};

module.exports = {
    orchestrator,
    sessionManager,
    memoryManager,
    config,
    agents,
    tools
};
