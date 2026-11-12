'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildServer } = require('../server');

test('GET /healthz reports readiness', async (t) => {
  const app = buildServer();
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/healthz' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });
});

test('GET /api/ping returns a plain-text baseline', async (t) => {
  const app = buildServer();
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/ping' });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /^text\/plain/);
  assert.equal(response.body, 'pong');
});
