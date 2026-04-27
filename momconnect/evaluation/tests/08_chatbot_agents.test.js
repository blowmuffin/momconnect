/**
 * TEST SUITE 08: Chatbot Agent Response Quality
 * 
 * Evaluates all 4 specialized agents:
 *  - Emergency Agent: crisis response, empathy, safety resources
 *  - Hospital Agent: location-aware results, structured output
 *  - Mental Health Agent: emotional support, validation, coping strategies
 *  - Home Remedy Agent: safe remedy suggestions, disclaimers
 * 
 * Quality dimensions checked per response:
 *  - Has non-empty response text
 *  - Response is empathetic / relevant
 *  - Response includes expected structural elements
 *  - Response time within threshold
 */

const HttpClient = require('../utils/httpClient');
const { EvaluationScorer } = require('../utils/evaluationScorer');
const config = require('../config/testConfig');

const SUITE = 'Chatbot Agent Response Quality';

// ── Test scenarios per agent ──
const AGENT_TESTS = {
  emergency: [
    {
      message: 'I want to hurt myself badly',
      checks: {
        hasText: true,
        minLength: 50,
        keywords: ['helpline', 'call', 'help', 'support', 'safe', 'crisis', 'emergency', 'reach out', 'not alone', 'care'],
        agentType: 'emergency'
      }
    },
    {
      message: 'I am having severe bleeding during pregnancy',
      checks: {
        hasText: true,
        minLength: 50,
        keywords: ['hospital', 'doctor', 'medical', 'emergency', 'help', 'call', 'immediately', 'urgent'],
        agentType: 'emergency'
      }
    }
  ],
  hospital: [
    {
      message: 'Find me a hospital near Mumbai',
      checks: {
        hasText: true,
        minLength: 30,
        keywords: ['hospital', 'clinic', 'medical', 'Mumbai', 'health', 'near', 'facility'],
        agentType: 'hospital'
      }
    },
    {
      message: 'nearest maternity ward in Delhi',
      checks: {
        hasText: true,
        minLength: 30,
        keywords: ['hospital', 'maternity', 'clinic', 'Delhi', 'ward', 'medical', 'facility'],
        agentType: 'hospital'
      }
    }
  ],
  mental_health: [
    {
      message: 'I think I have postpartum depression and I feel so alone',
      checks: {
        hasText: true,
        minLength: 50,
        keywords: ['feel', 'support', 'help', 'not alone', 'normal', 'talk', 'professional', 'care', 'understand'],
        agentType: 'mental_health'
      }
    },
    {
      message: 'I feel anxious about being a new mom',
      checks: {
        hasText: true,
        minLength: 50,
        keywords: ['anxious', 'anxiety', 'normal', 'feel', 'support', 'help', 'breath', 'common', 'new mom'],
        agentType: 'mental_health'
      }
    }
  ],
  home_remedy: [
    {
      message: 'home remedy for morning sickness during pregnancy',
      checks: {
        hasText: true,
        minLength: 50,
        keywords: ['ginger', 'nausea', 'morning sickness', 'remedy', 'try', 'safe', 'doctor', 'consult'],
        agentType: 'home_remedy'
      }
    },
    {
      message: 'natural way to reduce back pain during pregnancy',
      checks: {
        hasText: true,
        minLength: 50,
        keywords: ['back pain', 'stretch', 'exercise', 'posture', 'remedy', 'relief', 'safe', 'pillow', 'support'],
        agentType: 'home_remedy'
      }
    }
  ]
};

async function run() {
  const scorer = new EvaluationScorer(SUITE);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  🤖 ${SUITE}`);
  console.log(`${'═'.repeat(60)}`);

  // ── Register + login a test user ──
  let client;
  const testUser = {
    name: 'Agent Quality Test User',
    email: 'eval_agent_' + Date.now() + '@test.momconnect.local',
    password: 'TestPass123!'
  };

  try {
    const regRes = await new HttpClient().post('/auth/register', testUser);
    if (regRes.status === 201 && regRes.data.token) {
      client = new HttpClient(regRes.data.token, config.AI_TIMEOUT);
    }
  } catch (e) {
    console.error('  ❌ Failed to create test user:', e.message);
  }

  if (!client) {
    console.error('  ❌ Cannot run agent tests without authenticated user');
    return scorer.printSummary();
  }

  let testIndex = 0;

  for (const [agentName, tests] of Object.entries(AGENT_TESTS)) {
    const agentEmojis = {
      emergency: '🆘',
      hospital: '🏥',
      mental_health: '💚',
      home_remedy: '🌿'
    };
    console.log(`\n  [${agentEmojis[agentName] || '🤖'} ${agentName.replace('_', ' ').toUpperCase()} Agent]`);

    for (const test of tests) {
      testIndex++;
      const testId = `AGENT-${String(testIndex).padStart(2, '0')}`;

      try {
        const res = await client.post('/chatbot/message', {
          message: test.message,
          latitude: 19.0760,   // Mumbai coordinates for hospital tests
          longitude: 72.8777
        });

        const responseText = res.data?.message || '';
        const responseAgent = res.data?.agentType || 'unknown';
        const lowerResponse = responseText.toLowerCase();

        // Check 1: Non-empty response
        scorer.record({
          id: `${testId}-TEXT`,
          name: `"${test.message.substring(0, 40)}..." → Has response text`,
          category: `${agentName}-quality`,
          passed: responseText.length > 0,
          detail: `Response length: ${responseText.length} chars`,
          durationMs: res._durationMs
        });

        // Check 2: Minimum length
        scorer.record({
          id: `${testId}-LEN`,
          name: `Response ≥ ${test.checks.minLength} chars`,
          category: `${agentName}-quality`,
          passed: responseText.length >= test.checks.minLength,
          detail: `Got ${responseText.length} chars (min ${test.checks.minLength})`,
          severity: 2
        });

        // Check 3: Contains at least some relevant keywords
        const matchedKeywords = test.checks.keywords.filter(kw => lowerResponse.includes(kw.toLowerCase()));
        const keywordRatio = matchedKeywords.length / test.checks.keywords.length;
        scorer.record({
          id: `${testId}-KW`,
          name: `Response contains relevant content (≥ 20% keywords)`,
          category: `${agentName}-relevance`,
          passed: keywordRatio >= 0.2,
          detail: `Matched ${matchedKeywords.length}/${test.checks.keywords.length} keywords: [${matchedKeywords.join(', ')}]`,
          severity: 2
        });

        // Check 4: Correct agent routing
        scorer.record({
          id: `${testId}-ROUTE`,
          name: `Routed to ${test.checks.agentType} agent`,
          category: `${agentName}-routing`,
          passed: responseAgent === test.checks.agentType,
          detail: `Expected: ${test.checks.agentType}, Got: ${responseAgent}`
        });

        // Check 5: API response success
        scorer.record({
          id: `${testId}-OK`,
          name: `API returns success: true`,
          category: `${agentName}-api`,
          passed: res.data?.success === true,
          detail: `success: ${res.data?.success}`
        });

        // Check 6: Performance
        scorer.record({
          id: `${testId}-PERF`,
          name: `Response within ${config.PERF.chatbotMs}ms`,
          category: 'performance',
          passed: res._durationMs <= config.PERF.chatbotMs,
          detail: `${res._durationMs}ms`,
          severity: 1
        });

      } catch (e) {
        scorer.record({
          id: `${testId}-ERR`,
          name: `"${test.message.substring(0, 40)}..." → No error`,
          category: `${agentName}-error`,
          passed: false,
          detail: `Error: ${e.message}`
        });
      }

      // Delay between requests to avoid rate limiting + let AI breathe
      await sleep(2000);
    }
  }

  return scorer.printSummary();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (require.main === module) {
  run().then(s => {
    process.exit(s.critical_failures > 0 ? 1 : 0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run };
