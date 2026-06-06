/**
 * MomConnect Evaluation — Master Test Runner
 * Runs all agent-related test suites and prints a combined report
 */

const { computeFinalScore } = require('./utils/evaluationScorer');
const config = require('./config/testConfig');

// Test suites to run (in order)
const SUITES = [
  { file: './tests/07_chatbot_intent.test.js', dimension: 'aiQuality', label: '🧠 Intent Classification' },
  { file: './tests/08_chatbot_agents.test.js', dimension: 'aiQuality', label: '🤖 Agent Response Quality' },
  { file: './tests/09_emergency.test.js', dimension: 'emergency', label: '🆘 Emergency Crisis Detection' }
];

async function main() {
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║  MomConnect — AI Agent Evaluation Suite                   ║');
  console.log('║  ' + new Date().toISOString() + '                    ║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log(`\n  Target: ${config.BASE_URL}`);
  console.log(`  AI Timeout: ${config.AI_TIMEOUT}ms`);
  console.log(`  Verbose: ${config.VERBOSE}\n`);

  const results = {};
  let totalPassed = 0;
  let totalTests = 0;
  let totalCritical = 0;
  let crashedSuites = 0;
  const startTime = Date.now();

  for (const suite of SUITES) {
    try {
      const mod = require(suite.file);
      const summary = await mod.run();
      results[suite.dimension] = results[suite.dimension]
        ? mergeSummaries(results[suite.dimension], summary)
        : summary;
      totalPassed += summary.passed;
      totalTests += summary.total;
      totalCritical += summary.critical_failures;
    } catch (err) {
      crashedSuites++;
      console.error(`\n  ❌ ${suite.label} CRASHED: ${err.message}`);
      console.error(err.stack);
    }
  }

  const totalDuration = Date.now() - startTime;

  // ── Final Report ──
  console.log('\n\n' + '═'.repeat(60));
  console.log('  📋 FINAL EVALUATION REPORT');
  console.log('═'.repeat(60));

  const finalScore = computeFinalScore(results, config.SCORE_WEIGHTS);

  console.log(`\n  Final Score: ${finalScore.finalScore}% (Grade: ${finalScore.grade})`);
  console.log(`  Total Tests: ${totalTests} | Passed: ${totalPassed} | Failed: ${totalTests - totalPassed}`);
  console.log(`  Critical Failures: ${totalCritical}`);
  console.log(`  Crashed Suites: ${crashedSuites}`);
  console.log(`  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);

  console.log('\n  Breakdown by Dimension:');
  for (const [dim, info] of Object.entries(finalScore.breakdown)) {
    console.log(`    ${dim}: ${info.passRate}% (weight ${info.weight}, contribution ${info.contribution})`);
  }

  console.log('\n' + '═'.repeat(60));

  // Fail the run on any of: a critical test failure, a crashed suite (a whole
  // dimension never ran), or zero tests executed (broken environment/setup —
  // e.g. backend unreachable). A "0 tests, exit 0" run must never look green.
  const failed = totalCritical > 0 || crashedSuites > 0 || totalTests === 0;
  if (totalTests === 0) {
    console.log('\n  ⚠️  No tests executed — check that the backend is running and reachable.');
  }
  process.exit(failed ? 1 : 0);
}

function mergeSummaries(a, b) {
  return {
    suiteName: a.suiteName + ' + ' + b.suiteName,
    total: a.total + b.total,
    passed: a.passed + b.passed,
    failed: a.failed + b.failed,
    critical_failures: a.critical_failures + b.critical_failures,
    passRate: (((a.passed + b.passed) / (a.total + b.total)) * 100).toFixed(1),
    durationMs: a.durationMs + b.durationMs,
    results: [...a.results, ...b.results]
  };
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
