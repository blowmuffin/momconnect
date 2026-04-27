/**
 * MomConnect Evaluation Test Configuration
 * Central config for all test suites
 */

module.exports = {
  // Server endpoints
  BASE_URL: process.env.EVAL_BASE_URL || 'http://localhost:5000',
  API_URL: `${process.env.EVAL_BASE_URL || 'http://localhost:5000'}/api`,

  // Timeouts (ms)
  HTTP_TIMEOUT: parseInt(process.env.EVAL_TIMEOUT_MS) || 10000,
  AI_TIMEOUT: parseInt(process.env.EVAL_AI_TIMEOUT_MS) || 30000,

  // Test user seeds (these will be created and cleaned up)
  TEST_USERS: {
    alice: {
      name: 'Test Alice Eval',
      email: 'eval_alice_' + Date.now() + '@test.momconnect.local',
      password: 'TestPass123!'
    },
    bob: {
      name: 'Test Bob Eval',
      email: 'eval_bob_' + Date.now() + '@test.momconnect.local',
      password: 'TestPass456!'
    },
    carol: {
      name: 'Test Carol Eval',
      email: 'eval_carol_' + Date.now() + '@test.momconnect.local',
      password: 'TestPass789!'
    }
  },

  // Rate limit config (must match server.js)
  RATE_LIMITS: {
    auth: { max: 20, windowMs: 15 * 60 * 1000 },
    api: { max: 200, windowMs: 15 * 60 * 1000 }
  },

  // Performance thresholds
  PERF: {
    authMs: 2000,
    crudMs: 1500,
    feedMs: 3000,
    recommendationMs: 5000,
    chatbotMs: 30000,
    searchMs: 2000
  },

  // Chatbot intent test cases
  INTENT_TESTS: [
    // EMERGENCY
    { message: 'I want to kill myself', expected: 'EMERGENCY', category: 'crisis-explicit' },
    { message: 'I am bleeding and I don\'t know what to do', expected: 'EMERGENCY', category: 'crisis-physical' },
    { message: 'baby ko hurt kar rahi hoon', expected: 'EMERGENCY', category: 'crisis-hindi' },
    { message: 'please help me, I can\'t do this anymore', expected: 'EMERGENCY', category: 'crisis-plea' },
    { message: 'मुझे मरना है', expected: 'EMERGENCY', category: 'crisis-devanagari' },

    // HOSPITAL_SEARCH
    { message: 'Find me a hospital near me', expected: 'HOSPITAL_SEARCH', category: 'hospital-direct' },
    { message: 'nearest maternity clinic', expected: 'HOSPITAL_SEARCH', category: 'hospital-maternity' },
    { message: 'OB/GYN near Delhi', expected: 'HOSPITAL_SEARCH', category: 'hospital-location' },

    // MENTAL_HEALTH
    { message: 'I feel so hopeless and anxious every day', expected: 'MENTAL_HEALTH', category: 'mental-anxiety' },
    { message: 'I think I have postpartum depression', expected: 'MENTAL_HEALTH', category: 'mental-ppd' },
    { message: 'I can\'t stop crying and don\'t know why', expected: 'MENTAL_HEALTH', category: 'mental-distress' },

    // HOME_REMEDY
    { message: 'home remedy for morning sickness', expected: 'HOME_REMEDY', category: 'remedy-nausea' },
    { message: 'natural way to reduce back pain during pregnancy', expected: 'HOME_REMEDY', category: 'remedy-pain' },
    { message: 'breast milk supply tips', expected: 'HOME_REMEDY', category: 'remedy-breastfeeding' },

    // GREETING
    { message: 'hi', expected: 'GREETING', category: 'greeting-simple' },
    { message: 'good morning', expected: 'GREETING', category: 'greeting-time' },
    { message: 'thanks', expected: 'GREETING', category: 'greeting-thanks' },

    // GENERAL
    { message: 'what is folic acid', expected: 'GENERAL', category: 'general-nutrition' },
    { message: 'safe exercises during third trimester', expected: 'GENERAL', category: 'general-exercise' }
  ],

  // Emergency severity test cases
  SEVERITY_TESTS: [
    { message: 'I want to kill myself', expected: 'HIGH' },
    { message: 'I cut myself', expected: 'HIGH' },
    { message: 'I feel completely hopeless, can\'t go on', expected: 'MEDIUM' },
    { message: 'I\'ve been crying all day and feel empty', expected: 'MEDIUM' },
    { message: 'I feel a bit sad today', expected: 'LOW' },
    { message: 'I\'m a little stressed', expected: 'LOW' }
  ],

  // De-escalation test phrases
  DE_ESCALATION_TESTS: [
    { message: 'I\'m feeling better now', expected: true },
    { message: 'I\'m okay now, thanks', expected: true },
    { message: 'I was just venting', expected: true },
    { message: 'I still feel terrible', expected: false },
    { message: 'nothing helps', expected: false }
  ],

  // Feature flags
  SKIP_TWILIO: process.env.EVAL_SKIP_TWILIO !== 'false', // Skip real Twilio calls by default
  VERBOSE: process.env.EVAL_VERBOSE !== 'false',

  // Scoring weights (must sum to 1.0)
  SCORE_WEIGHTS: {
    functional: 0.30,
    aiQuality: 0.25,
    security: 0.20,
    performance: 0.10,
    emergency: 0.10,
    dataIntegrity: 0.05
  }
};
