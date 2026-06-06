/**
 * HTTP Client Utility for MomConnect Evaluation Tests
 * Wraps axios with auth token injection, timing, and test-friendly error formatting
 */

const axios = require('axios');
const config = require('../config/testConfig');

class HttpClient {
  constructor(baseToken = null, timeout = null) {
    this.token = baseToken;
    this.client = axios.create({
      baseURL: config.API_URL,
      timeout: timeout || config.HTTP_TIMEOUT,
      validateStatus: () => true // Never throw on HTTP errors — let tests assert status codes
    });
  }

  setToken(token) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  _headers(extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  /**
   * Issue a request, timing it and never throwing. validateStatus suppresses
   * HTTP-status throws, but axios still throws on network/timeout errors
   * (ECONNREFUSED, ETIMEDOUT) — catch those and return a synthetic response so
   * test assertions degrade to a failed check (status 0) instead of crashing
   * the whole suite.
   */
  async _send(makeRequest) {
    const start = Date.now();
    try {
      const res = await makeRequest();
      res._durationMs = Date.now() - start;
      return res;
    } catch (err) {
      return {
        status: err.response?.status ?? 0,
        data: err.response?.data ?? { message: err.message },
        headers: err.response?.headers ?? {},
        _durationMs: Date.now() - start,
        _networkError: !err.response
      };
    }
  }

  async get(path, params = {}, extraHeaders = {}) {
    return this._send(() => this.client.get(path, {
      params,
      headers: this._headers(extraHeaders)
    }));
  }

  async post(path, body = {}, extraHeaders = {}) {
    return this._send(() => this.client.post(path, body, {
      headers: this._headers(extraHeaders)
    }));
  }

  async put(path, body = {}, extraHeaders = {}) {
    return this._send(() => this.client.put(path, body, {
      headers: this._headers(extraHeaders)
    }));
  }

  async delete(path, extraHeaders = {}) {
    return this._send(() => this.client.delete(path, {
      headers: this._headers(extraHeaders)
    }));
  }

  /**
   * Quick helper to register and immediately get token for a test user
   */
  static async registerUser(userData) {
    const client = new HttpClient();
    const res = await client.post('/auth/register', userData);
    if (res.status !== 201) {
      throw new Error(`Failed to register test user: ${JSON.stringify(res.data)}`);
    }
    client.setToken(res.data.token);
    return { client, user: res.data };
  }

  /**
   * Login helper
   */
  static async loginUser(email, password) {
    const client = new HttpClient();
    const res = await client.post('/auth/login', { email, password });
    if (res.status !== 200) {
      throw new Error(`Failed to login test user: ${JSON.stringify(res.data)}`);
    }
    client.setToken(res.data.token);
    return { client, user: res.data };
  }
}

module.exports = HttpClient;
