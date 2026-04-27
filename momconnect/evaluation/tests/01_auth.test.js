/**
 * TEST SUITE 01: Authentication & Authorization
 * 
 * Evaluates:
 *  - User registration (valid + edge cases)
 *  - Login / logout (valid + invalid credentials)
 *  - JWT token issuance and validation
 *  - Protected route enforcement
 *  - Password reset flow
 *  - Duplicate email prevention
 *  - Validation rejection (short password, bad email)
 */

const HttpClient = require('../utils/httpClient');
const { EvaluationScorer } = require('../utils/evaluationScorer');
const config = require('../config/testConfig');

const SUITE = 'Authentication & Authorization';

async function run() {
  const scorer = new EvaluationScorer(SUITE);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  🔐 ${SUITE}`);
  console.log(`${'═'.repeat(60)}`);

  const { alice } = config.TEST_USERS;
  let aliceClient, aliceUser;

  // ───────────────────────────────────────────────────
  // 1. Registration
  // ───────────────────────────────────────────────────
  console.log('\n  [Registration]');

  try {
    const res = await new HttpClient().post('/auth/register', alice);
    scorer.record({
      id: 'AUTH-01', name: 'Successful registration returns 201', category: 'registration',
      passed: res.status === 201,
      detail: `Status: ${res.status}`, durationMs: res._durationMs
    });
    scorer.record({
      id: 'AUTH-02', name: 'Response contains JWT token', category: 'registration',
      passed: !!res.data.token,
      detail: `token: ${res.data.token ? 'present' : 'MISSING'}`
    });
    scorer.record({
      id: 'AUTH-03', name: 'Password NOT returned in response', category: 'security',
      passed: !res.data.password,
      detail: `password: ${res.data.password ? 'EXPOSED ⚠️' : 'hidden'}`
    });

    aliceClient = new HttpClient(res.data.token);
    aliceUser = res.data;

  } catch (e) {
    scorer.record({ id: 'AUTH-01', name: 'Successful registration', category: 'registration', passed: false, detail: e.message, severity: 3 });
  }

  // Duplicate email
  const dupRes = await new HttpClient().post('/auth/register', alice);
  scorer.record({
    id: 'AUTH-04', name: 'Duplicate email rejected with 400', category: 'registration',
    passed: dupRes.status === 400,
    detail: `Status: ${dupRes.status} — ${dupRes.data?.message}`
  });

  // Short password
  const shortPwRes = await new HttpClient().post('/auth/register', {
    name: 'Test User', email: 'test_short_@local.test', password: '12345'
  });
  scorer.record({
    id: 'AUTH-05', name: 'Short password (< 6 chars) rejected with 400', category: 'validation',
    passed: shortPwRes.status === 400,
    detail: `Status: ${shortPwRes.status}`
  });

  // Invalid email format
  const badEmailRes = await new HttpClient().post('/auth/register', {
    name: 'Test User', email: 'not-an-email', password: 'Valid123!'
  });
  scorer.record({
    id: 'AUTH-06', name: 'Invalid email format rejected with 400', category: 'validation',
    passed: badEmailRes.status === 400,
    detail: `Status: ${badEmailRes.status}`
  });

  // Empty name
  const emptyNameRes = await new HttpClient().post('/auth/register', {
    name: '', email: 'empty_name_test@local.test', password: 'Valid123!'
  });
  scorer.record({
    id: 'AUTH-07', name: 'Empty name rejected with 400', category: 'validation',
    passed: emptyNameRes.status === 400,
    detail: `Status: ${emptyNameRes.status}`
  });

  // ───────────────────────────────────────────────────
  // 2. Login
  // ───────────────────────────────────────────────────
  console.log('\n  [Login]');

  const loginRes = await new HttpClient().post('/auth/login', {
    email: alice.email, password: alice.password
  });
  scorer.record({
    id: 'AUTH-08', name: 'Valid login returns 200 + token', category: 'login',
    passed: loginRes.status === 200 && !!loginRes.data.token,
    detail: `Status: ${loginRes.status}, token: ${loginRes.data.token ? 'present' : 'MISSING'}`,
    durationMs: loginRes._durationMs
  });
  scorer.record({
    id: 'AUTH-09', name: 'Login response includes user profile fields', category: 'login',
    passed: !!(loginRes.data.name && loginRes.data.email),
    detail: `name: ${loginRes.data.name}, email: ${loginRes.data.email}`
  });

  // Wrong password
  const wrongPwRes = await new HttpClient().post('/auth/login', {
    email: alice.email, password: 'WrongPassword!'
  });
  scorer.record({
    id: 'AUTH-10', name: 'Wrong password returns 401', category: 'login',
    passed: wrongPwRes.status === 401,
    detail: `Status: ${wrongPwRes.status}`
  });

  // Non-existent user
  const noUserRes = await new HttpClient().post('/auth/login', {
    email: 'nobody_exists@test.local', password: 'SomePass123!'
  });
  scorer.record({
    id: 'AUTH-11', name: 'Non-existent user returns 401 (not 404)', category: 'security',
    passed: noUserRes.status === 401,
    detail: `Status: ${noUserRes.status} — avoids user enumeration`
  });

  // ───────────────────────────────────────────────────
  // 3. Protected Routes
  // ───────────────────────────────────────────────────
  console.log('\n  [Protected Routes]');

  const noTokenClient = new HttpClient();
  const protectedRes = await noTokenClient.get('/auth/me');
  scorer.record({
    id: 'AUTH-12', name: 'GET /auth/me without token returns 401', category: 'authorization',
    passed: protectedRes.status === 401,
    detail: `Status: ${protectedRes.status}`
  });

  const fakeTokenClient = new HttpClient('fake.token.here');
  const fakeRes = await fakeTokenClient.get('/auth/me');
  scorer.record({
    id: 'AUTH-13', name: 'Fake/tampered JWT returns 401', category: 'authorization',
    passed: fakeRes.status === 401,
    detail: `Status: ${fakeRes.status}`
  });

  if (aliceClient) {
    const meRes = await aliceClient.get('/auth/me');
    scorer.record({
      id: 'AUTH-14', name: 'GET /auth/me with valid token returns 200', category: 'authorization',
      passed: meRes.status === 200 && meRes.data.email === alice.email,
      detail: `Status: ${meRes.status}, email match: ${meRes.data.email === alice.email}`
    });
  }

  // ───────────────────────────────────────────────────
  // 4. Logout
  // ───────────────────────────────────────────────────
  console.log('\n  [Logout]');

  if (aliceClient) {
    const logoutRes = await aliceClient.post('/auth/logout');
    scorer.record({
      id: 'AUTH-15', name: 'Logout returns 200', category: 'session',
      passed: logoutRes.status === 200,
      detail: `Status: ${logoutRes.status}`
    });
  }

  // ───────────────────────────────────────────────────
  // 5. Password Reset Flow
  // ───────────────────────────────────────────────────
  console.log('\n  [Password Reset]');

  const forgotRes = await new HttpClient().post('/auth/forgot-password', { email: alice.email });
  scorer.record({
    id: 'AUTH-16', name: 'Forgot-password returns 200 for known email', category: 'password-reset',
    passed: forgotRes.status === 200,
    detail: `Status: ${forgotRes.status}`
  });

  const forgotFakeRes = await new HttpClient().post('/auth/forgot-password', { email: 'nobody@test.local' });
  scorer.record({
    id: 'AUTH-17', name: 'Forgot-password returns 200 for UNKNOWN email (no enumeration)', category: 'security',
    passed: forgotFakeRes.status === 200,
    detail: `Status: ${forgotFakeRes.status} — consistent response prevents user enumeration`
  });

  const invalidResetRes = await new HttpClient().post('/auth/reset-password', {
    token: 'fake-reset-token-abc123', password: 'NewPass123!'
  });
  scorer.record({
    id: 'AUTH-18', name: 'Invalid/expired reset token returns 400', category: 'password-reset',
    passed: invalidResetRes.status === 400,
    detail: `Status: ${invalidResetRes.status}`
  });

  if (forgotRes.data?.resetToken) {
    const resetRes = await new HttpClient().post('/auth/reset-password', {
      token: forgotRes.data.resetToken, password: 'NewPassword456!'
    });
    scorer.record({
      id: 'AUTH-19', name: 'Valid reset token allows password change', category: 'password-reset',
      passed: resetRes.status === 200,
      detail: `Status: ${resetRes.status}`, durationMs: resetRes._durationMs
    });
  }

  return scorer.printSummary();
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
