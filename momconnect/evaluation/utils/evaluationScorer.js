/**
 * Evaluation Scorer Utility
 * Tracks pass/fail for each test and computes weighted final scores
 */

class EvaluationScorer {
  constructor(suiteName) {
    this.suiteName = suiteName;
    this.results = [];
    this.startTime = Date.now();
  }

  /**
   * Record a single test result
   * @param {Object} opts
   * @param {string} opts.id        - Unique test ID
   * @param {string} opts.name      - Human-readable description
   * @param {string} opts.category  - Test category
   * @param {boolean} opts.passed   - Did the test pass?
   * @param {string} opts.detail    - What was observed (pass) or what went wrong (fail)
   * @param {number} [opts.durationMs] - How long the test took
   * @param {number} [opts.severity]   - 1=info, 2=warning, 3=critical (default 3)
   */
  record({ id, name, category, passed, detail, durationMs, severity = 3 }) {
    const result = {
      id,
      name,
      category,
      passed,
      detail: String(detail || ''),
      durationMs: durationMs || null,
      severity,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);

    const icon = passed ? '✅' : (severity === 1 ? '⚠️' : '❌');
    const time = durationMs ? ` (${durationMs}ms)` : '';
    console.log(`  ${icon} [${category}] ${name}${time}`);
    if (!passed) console.log(`     ↳ ${detail}`);

    return passed;
  }

  /**
   * Assert a condition and auto-record
   */
  assert(condition, opts) {
    return this.record({ ...opts, passed: !!condition });
  }

  /**
   * Get summary for this suite
   */
  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const critical_failures = this.results.filter(r => !r.passed && r.severity === 3).length;
    const durationMs = Date.now() - this.startTime;

    return {
      suiteName: this.suiteName,
      total,
      passed,
      failed: total - passed,
      critical_failures,
      passRate: total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0',
      durationMs,
      results: this.results
    };
  }

  /**
   * Print and return summary
   */
  printSummary() {
    const s = this.getSummary();
    const bar = s.passRate >= 90 ? '🟢' : s.passRate >= 70 ? '🟡' : '🔴';
    console.log(`\n${bar} ${this.suiteName}: ${s.passed}/${s.total} passed (${s.passRate}%) — ${s.durationMs}ms`);
    if (s.critical_failures > 0) {
      console.log(`   ⚠️  ${s.critical_failures} critical failure(s)`);
    }
    return s;
  }
}

/**
 * Aggregate multiple suite summaries into a final weighted report
 */
function computeFinalScore(suiteResults, weights) {
  const breakdown = {};
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const [dimension, weight] of Object.entries(weights)) {
    const suite = suiteResults[dimension];
    if (!suite) continue;

    const rate = parseFloat(suite.passRate) || 0;
    breakdown[dimension] = {
      passRate: rate,
      weight: (weight * 100).toFixed(0) + '%',
      contribution: (rate * weight).toFixed(1)
    };
    totalWeightedScore += rate * weight;
    totalWeight += weight;
  }

  const finalScore = totalWeight > 0 ? (totalWeightedScore / totalWeight).toFixed(1) : '0.0';
  const grade = finalScore >= 90 ? 'A' : finalScore >= 80 ? 'B' : finalScore >= 70 ? 'C' : finalScore >= 60 ? 'D' : 'F';

  return { finalScore, grade, breakdown };
}

module.exports = { EvaluationScorer, computeFinalScore };
