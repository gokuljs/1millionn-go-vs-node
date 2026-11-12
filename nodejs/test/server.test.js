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

test('GET /api/json returns fixed JSON', async (t) => {
  const app = buildServer();
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/json' });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /^application\/json/);
  assert.deepEqual(response.json(), { message: 'ok' });
});

test('GET /api/payload returns exactly 1 KiB of fixed bytes', async (t) => {
  const app = buildServer();
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/payload' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'], 'application/octet-stream');
  assert.equal(response.rawPayload.length, 1024);
  assert.deepEqual(response.rawPayload, Buffer.alloc(1024, 0x78));
});

test('POST /api/echo returns the submitted JSON object', async (t) => {
  const app = buildServer();
  t.after(() => app.close());
  const body = { message: 'hello', count: 2 };

  const response = await app.inject({
    method: 'POST',
    url: '/api/echo',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify(body),
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), body);
});

test('POST /api/echo rejects non-object JSON', async (t) => {
  const app = buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/echo',
    headers: { 'content-type': 'application/json' },
    payload: '[1,2,3]',
  });
  assert.equal(response.statusCode, 400);
});

test('POST /api/echo limits request bodies to 64 KiB', async (t) => {
  const app = buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/echo',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ message: 'x'.repeat(64 * 1024) }),
  });
  assert.equal(response.statusCode, 413);
});
