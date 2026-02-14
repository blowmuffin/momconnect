/**
 * Lightweight Circuit Breaker
 * Wraps async function calls with a state machine:
 *   CLOSED (normal) → OPEN (failing) → HALF_OPEN (probing)
 * No external dependencies.
 */

class CircuitBreaker {
    /**
     * @param {Object} options
     * @param {string} options.name - Name for logging
     * @param {number} options.failureThreshold - Consecutive failures before opening (default: 5)
     * @param {number} options.resetTimeoutMs - Time before trying again (default: 30000)
     * @param {Function} options.fallback - Optional fallback function when circuit is open
     */
    constructor(options = {}) {
        this.name = options.name || 'unknown';
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeoutMs = options.resetTimeoutMs || 30000;
        this.fallback = options.fallback || null;

        this.state = 'CLOSED';      // CLOSED | OPEN | HALF_OPEN
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.successCount = 0;
    }

    /**
     * Execute a function through the circuit breaker
     * @param {Function} fn - Async function to execute
     * @param  {...any} args - Arguments to pass to the function
     * @returns {*} Result of fn or fallback
     */
    async exec(fn, ...args) {
        if (this.state === 'OPEN') {
            // Check if enough time has passed to try again
            const elapsed = Date.now() - this.lastFailureTime;
            if (elapsed >= this.resetTimeoutMs) {
                this.state = 'HALF_OPEN';
                console.log(`[CircuitBreaker:${this.name}] Transitioning to HALF_OPEN — probing...`);
            } else {
                // Circuit is still open — use fallback
                console.log(`[CircuitBreaker:${this.name}] Circuit OPEN — using fallback (${Math.round((this.resetTimeoutMs - elapsed) / 1000)}s until retry)`);
                if (this.fallback) {
                    return this.fallback(...args);
                }
                throw new Error(`[CircuitBreaker:${this.name}] Circuit is OPEN and no fallback provided`);
            }
        }

        try {
            const result = await fn(...args);
            this._onSuccess();
            return result;
        } catch (error) {
            this._onFailure();
            // In HALF_OPEN, go back to OPEN immediately
            if (this.state === 'HALF_OPEN') {
                this.state = 'OPEN';
                this.lastFailureTime = Date.now();
                console.log(`[CircuitBreaker:${this.name}] Probe failed — back to OPEN`);
            }

            if (this.state === 'OPEN' && this.fallback) {
                console.log(`[CircuitBreaker:${this.name}] Using fallback after failure`);
                return this.fallback(...args);
            }
            throw error;
        }
    }

    _onSuccess() {
        if (this.state === 'HALF_OPEN') {
            console.log(`[CircuitBreaker:${this.name}] Probe succeeded — circuit CLOSED`);
        }
        this.failureCount = 0;
        this.state = 'CLOSED';
        this.successCount++;
    }

    _onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.failureThreshold && this.state === 'CLOSED') {
            this.state = 'OPEN';
            console.log(`[CircuitBreaker:${this.name}] Circuit OPENED after ${this.failureCount} consecutive failures`);
        }
    }

    /**
     * Get current state info (for health checks)
     */
    getStatus() {
        return {
            name: this.name,
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null
        };
    }

    /**
     * Force reset the circuit breaker
     */
    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = null;
    }
}

module.exports = CircuitBreaker;
