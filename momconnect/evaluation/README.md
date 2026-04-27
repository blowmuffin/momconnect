# MomConnect — Model Evaluation Test Suite

A **standalone** evaluation framework that covers every critical dimension of the MomConnect platform — from API correctness and security to AI chatbot quality, recommendation relevance, and real-time communication.

## Directory Structure

```
evaluation/
├── README.md                       ← This file
├── run_all.js                      ← Master test runner
├── config/
│   └── testConfig.js               ← Base URLs, timeouts, test-user credentials
├── tests/
│   ├── 01_auth.test.js             ← Authentication & authorization
│   ├── 02_users.test.js            ← User profiles, follow/unfollow, search
│   ├── 03_posts.test.js            ← CRUD, like, comment, save, visibility
│   ├── 04_recommendations.test.js  ← 7-signal recommendation engine
│   ├── 05_groups.test.js           ← Group creation, membership, posts
│   ├── 06_messages.test.js         ← DMs, real-time socket events
│   ├── 07_chatbot_intent.test.js   ← Intent classification accuracy
│   ├── 08_chatbot_agents.test.js   ← Agent response quality (all 4 agents)
│   ├── 09_emergency.test.js        ← Crisis detection, severity, escalation
│   ├── 10_security.test.js         ← Rate limiting, SQL injection, XSS, IDOR
│   ├── 11_performance.test.js      ← Response times, pagination, load
│   └── 12_memory_session.test.js   ← Memory persistence, session lifecycle
└── utils/
    ├── httpClient.js               ← Axios wrapper with auth headers
    ├── socketClient.js             ← Socket.IO test client wrapper
    ├── evaluationScorer.js         ← Weighted scoring engine
    └── reportGenerator.js          ← HTML + JSON report writer
```

## Quick Start

```bash
# Install evaluation dependencies (separate from main project)
cd evaluation
npm install

# Run the full evaluation suite
node run_all.js

# Run a single test file
node tests/09_emergency.test.js

# Generate HTML report only
node utils/reportGenerator.js
```

## Scoring Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Functional Correctness | 30% | All CRUD + business logic works as expected |
| AI Quality | 25% | Intent accuracy, response empathy, agent routing |
| Security | 20% | Auth, rate limits, injection, IDOR protection |
| Performance | 10% | Response times under thresholds |
| Emergency Reliability | 10% | Crisis detection, cooldown, escalation |
| Data Integrity | 5% | Notifications, interactions, memory updates |

## Prerequisites

- Backend running on `http://localhost:5000`
- `.env` file with valid `JWT_SECRET`, `MONGO_URI`, `GEMINI_API_KEY`
- Test MongoDB instance (the suite creates and cleans up its own test data)

## Environment Variables for Evaluation

```env
EVAL_BASE_URL=http://localhost:5000
EVAL_TIMEOUT_MS=10000
EVAL_AI_TIMEOUT_MS=30000
EVAL_SKIP_TWILIO=true        # Set false only if Twilio creds are present
EVAL_VERBOSE=true            # Detailed per-test logging
```
