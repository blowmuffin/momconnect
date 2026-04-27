# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously at MomConnect, especially given the sensitive nature of maternal health data.

**Please DO NOT open a public GitHub issue for security vulnerabilities.**

Instead, report vulnerabilities by emailing **[INSERT SECURITY EMAIL]** with:

1. **Description** of the vulnerability
2. **Steps to reproduce** the issue
3. **Impact assessment** — what data/functionality is affected
4. **Suggested fix** (if you have one)

### What to Expect

- **Acknowledgment** within 48 hours
- **Assessment** within 1 week
- **Fix or mitigation** for critical issues within 2 weeks
- **Credit** in release notes (unless you prefer anonymity)

## Security Measures in Place

MomConnect implements defense-in-depth security:

- **Helmet.js** — HTTP security headers (CSP, HSTS, X-Frame-Options)
- **Rate Limiting** — Per-IP and per-user request throttling
- **JWT Authentication** — Stateless auth with bcrypt password hashing (12 salt rounds)
- **Input Validation** — express-validator on all auth routes, message truncation
- **NoSQL Injection Prevention** — express-mongo-sanitize strips `$` and `.` operators
- **File Upload Restrictions** — 5MB limit, extension whitelist
- **TwiML Injection Prevention** — Input sanitization for Twilio voice/SMS
- **Emergency Cooldown** — Prevents accidental mass notification triggers
- **Circuit Breaker** — Fault tolerance on external API calls

## Sensitive Data

The following data is handled with special care:

- User passwords (bcrypt hashed, never returned in API responses)
- Emergency contact information
- Health-related chat conversations
- GPS location data (used only for emergency response and hospital search)
- Twilio credentials (environment variables, never committed)

## Environment Variables

All secrets and API keys are stored in `.env` files which are **gitignored**. See `backend/.env.example` for the required variables. Never commit actual credentials.
