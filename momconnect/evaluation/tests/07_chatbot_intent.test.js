/**
 * TEST SUITE 07: Chatbot Intent Classification
 * 
 * Evaluates:
 *  - Correct intent routing for EMERGENCY, HOSPITAL_SEARCH, MENTAL_HEALTH,
 *    HOME_REMEDY, GREETING, and GENERAL messages
 *  - Classification accuracy across categories
 *  - Response time within AI timeout threshold
 */

const HttpClient = require('../utils/httpClient');
const { EvaluationScorer } = require('../utils/evaluationScorer');
const config = require('../config/testConfig');

const SUITE = 'Chatbot Intent Classification';

async function run() {
  const scorer = new EvaluationScorer(SUITE);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  🧠 ${SUITE}`);
  console.log(`${'═'.repeat(60)}`);

  // ── Register + login a test user ──
  let client;
  const testUser = {
    name: 'Intent Test User',
    email: 'eval_intent_' + Date.now() + '@test.momconnect.local',
    password: 'TestPass123!'
  };

  try {
    const regRes = await new HttpClient().post('/auth/register', testUser);
    if (regRes.status === 201 && regRes.data.token) {
      client = new HttpClient(regRes.data.token, config.AI_TIMEOUT);
    } else {
      // Try login in case user already exists
      const loginRes = await new HttpClient().post('/auth/login', {
        email: testUser.email, password: testUser.password
      });
      if (loginRes.status === 200 && loginRes.data.token) {
        client = new HttpClient(loginRes.data.token, config.AI_TIMEOUT);
      }
    }
  } catch (e) {
    console.error('  ❌ Failed to create test user:', e.message);
  }

  if (!client) {
    console.error('  ❌ Cannot run intent tests without authenticated user');
    return scorer.printSummary();
  }

  // ── Run intent tests ──
  const intentTests = config.INTENT_TESTS;
  let correct = 0;
  let total = intentTests.length;

  for (let i = 0; i < intentTests.length; i++) {
    const test = intentTests[i];
    const testId = `INTENT-${String(i + 1).padStart(2, '0')}`;

    try {
      const res = await client.post('/chatbot/message', {
        message: test.message
      });

      const intent = res.data?.metadata?.intent || 'UNKNOWN';
      const confidence = res.data?.metadata?.confidence || 0;
      const passed = intent === test.expected;
      if (passed) correct++;

      scorer.record({
        id: testId,
        name: `"${test.message}" → ${test.expected}`,
        category: test.category,
        passed,
        detail: `Got: ${intent} (${confidence}%) | Expected: ${test.expected}`,
        durationMs: res._durationMs
      });

      // Also check response time is within AI timeout
      scorer.record({
        id: `${testId}-PERF`,
        name: `Response within ${config.PERF.chatbotMs}ms`,
        category: 'performance',
        passed: res._durationMs <= config.PERF.chatbotMs,
        detail: `${res._durationMs}ms`,
        durationMs: res._durationMs,
        severity: 1
      });

    } catch (e) {
      scorer.record({
        id: testId,
        name: `"${test.message}" → ${test.expected}`,
        category: test.category,
        passed: false,
        detail: `Error: ${e.message}`
      });
    }

    // Small delay between requests to avoid rate limiting
    await sleep(1500);
  }

  // ── Overall accuracy ──
  const accuracy = ((correct / total) * 100).toFixed(1);
  console.log(`\n  📊 Intent accuracy: ${correct}/${total} (${accuracy}%)`);

  scorer.record({
    id: 'INTENT-ACCURACY',
    name: `Overall intent accuracy ≥ 70%`,
    category: 'accuracy',
    passed: parseFloat(accuracy) >= 70,
    detail: `${correct}/${total} correct (${accuracy}%)`
  });

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
