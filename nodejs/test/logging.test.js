'use strict';

const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const test = require('node:test');
const { buildServer } = require('../server');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function captureServer(t, options = {}) {
  let output = '';
  const stream = new Writable({
    write(chunk, _encoding, done) {
      output += chunk.toString();
      done();
    },
  });
  const app = buildServer({ logLevel: 'info', ...options, logStream: stream });
  t.after(() => app.close());

  return {
    app,
    output: () => output,
    records: () => output.trim() ? output.trim().split('\n').map(JSON.parse) : [],
  };
}

test('completed requests have structured metadata and server-generated request IDs', async (t) => {
  const capture = captureServer(t);
  const first = await capture.app.inject({
    method: 'GET',
    url: '/api/ping?token=query-secret',
    headers: {
      'x-request-id': 'caller-controlled-id',
      authorization: 'Bearer authorization-secret',
      cookie: 'session=cookie-secret',
    },
  });
  const second = await capture.app.inject({ method: 'GET', url: '/api/ping' });

  assert.equal(first.statusCode, 200);
  assert.equal(first.body, 'pong');
  const records = capture.records();
  assert.equal(records.length, 2);
  assert.equal(records[0].msg, 'request completed');
  assert.equal(records[0].level, 30);
  assert.equal(records[0].method, 'GET');
  assert.equal(records[0].route, '/api/ping');
  assert.equal(records[0].statusCode, 200);
  assert.equal(typeof records[0].time, 'number');
  assert.equal(typeof records[0].responseTime, 'number');
  assert.ok(records[0].responseTime >= 0);
  assert.match(records[0].reqId, UUID);
  assert.equal(first.headers['x-request-id'], records[0].reqId);
  assert.equal(second.headers['x-request-id'], records[1].reqId);
  assert.notEqual(records[0].reqId, records[1].reqId);
  for (const secret of ['query-secret', 'authorization-secret', 'cookie-secret', 'caller-controlled-id']) {
    assert.ok(!capture.output().includes(secret));
  }
});

test('logs contain route templates rather than dynamic parameters or unmatched URLs', async (t) => {
  const capture = captureServer(t);
  capture.app.get('/users/:id', async () => ({ status: 'ok' }));

  const matched = await capture.app.inject({ method: 'GET', url: '/users/private-user-id' });
  const unmatched = await capture.app.inject({
    method: 'GET',
    url: '/unknown/private-path?token=private-query',
  });

  assert.equal(matched.statusCode, 200);
  assert.equal(unmatched.statusCode, 404);
  const records = capture.records();
  assert.equal(records.length, 2);
  assert.equal(records[0].route, '/users/:id');
  assert.equal(records[1].route, null);
  assert.equal(records[1].statusCode, 404);
  assert.equal(records[1].level, 40);
  for (const secret of ['private-user-id', 'private-path', 'private-query']) {
    assert.ok(!capture.output().includes(secret));
  }
});

test('echo requests keep request and response bodies out of logs', async (t) => {
  const capture = captureServer(t);
  const payload = { password: 'private-body-secret', message: 'private-response-secret' };
  const response = await capture.app.inject({
    method: 'POST',
    url: '/api/echo',
    payload,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), payload);
  const records = capture.records();
  assert.equal(records.length, 1);
  assert.equal(records[0].method, 'POST');
  assert.equal(records[0].route, '/api/echo');
  assert.ok(!capture.output().includes('private-body-secret'));
  assert.ok(!capture.output().includes('private-response-secret'));
});

test('malformed JSON is logged safely without the parser error message or body', async (t) => {
  const capture = captureServer(t);
  const response = await capture.app.inject({
    method: 'POST',
    url: '/api/echo',
    headers: { 'content-type': 'application/json' },
    payload: 'private-parser-secret',
  });

  assert.equal(response.statusCode, 400);
  const records = capture.records();
  assert.equal(records.length, 1);
  assert.equal(records[0].level, 40);
  assert.equal(records[0].statusCode, 400);
  assert.equal(records[0].error.code, 'FST_ERR_CTP_INVALID_JSON_BODY');
  assert.ok(!capture.output().includes('private-parser-secret'));
  assert.equal(records[0].error.message, undefined);
  assert.equal(records[0].error.stack, undefined);
});

test('validation and size errors retain endpoint behavior and produce warning logs', async (t) => {
  const capture = captureServer(t);
  const invalid = await capture.app.inject({
    method: 'POST',
    url: '/api/echo',
    headers: { 'content-type': 'application/json' },
    payload: '[1,2,3]',
  });
  const oversized = await capture.app.inject({
    method: 'POST',
    url: '/api/echo',
    payload: { message: 'x'.repeat(64 * 1024) },
  });

  assert.equal(invalid.statusCode, 400);
  assert.equal(oversized.statusCode, 413);
  const records = capture.records();
  assert.equal(records.length, 2);
  assert.deepEqual(records.map((record) => record.statusCode), [400, 413]);
  assert.deepEqual(records.map((record) => record.level), [40, 40]);
  assert.equal(records[0].error.code, 'FST_ERR_VALIDATION');
  assert.equal(records[1].error.code, 'FST_ERR_CTP_BODY_TOO_LARGE');
});

test('server failures produce error logs with safe error metadata', async (t) => {
  const capture = captureServer(t);
  capture.app.get('/test/error', async () => {
    throw Object.assign(new Error('private-database-error-message'), { code: 'EXPERIMENT_FAILURE' });
  });

  const response = await capture.app.inject({ method: 'GET', url: '/test/error' });

  assert.equal(response.statusCode, 500);
  const records = capture.records();
  assert.equal(records.length, 1);
  assert.equal(records[0].level, 50);
  assert.equal(records[0].statusCode, 500);
  assert.equal(records[0].route, '/test/error');
  assert.equal(records[0].error.type, 'Error');
  assert.equal(records[0].error.code, 'EXPERIMENT_FAILURE');
  assert.ok(!capture.output().includes('private-database-error-message'));
  assert.equal(records[0].error.message, undefined);
  assert.equal(records[0].error.stack, undefined);
});

test('trace logs for malformed HTTP exclude raw packets and sensitive error details', async (t) => {
  const capture = captureServer(t, { logLevel: 'trace' });
  const rawPacket = Buffer.from(
    'GET /api/ping?token=private-client-query HTTP/1.1\r\n' +
    'Authorization: Bearer private-client-header\r\n\r\n',
  );
  const error = Object.assign(new Error('private-client-error-message'), {
    code: 'HPE_INVALID_METHOD',
    rawPacket,
  });
  let written = '';
  let destroyedWith;
  const socket = {
    destroyed: false,
    writable: true,
    write(data) { written += data; },
    destroy(reason) { destroyedWith = reason; },
  };

  capture.app.server.emit('clientError', error, socket);

  assert.match(written, /^HTTP\/1\.1 400 Bad Request\r\n/);
  assert.equal(destroyedWith, error);
  const records = capture.records();
  assert.equal(records.length, 1);
  assert.equal(records[0].level, 10);
  assert.equal(records[0].msg, 'client error');
  assert.deepEqual(records[0].err, { type: 'Error', code: 'HPE_INVALID_METHOD' });
  for (const secret of ['private-client-query', 'private-client-header', 'private-client-error-message']) {
    assert.ok(!capture.output().includes(secret));
  }
  assert.ok(!capture.output().includes(JSON.stringify([...rawPacket])));
});

test('warning log level filters successful requests while retaining client errors', async (t) => {
  const capture = captureServer(t, { logLevel: 'warn' });
  await capture.app.inject({ method: 'GET', url: '/api/ping' });
  await capture.app.inject({ method: 'GET', url: '/missing' });

  const records = capture.records();
  assert.equal(records.length, 1);
  assert.equal(records[0].statusCode, 404);
  assert.equal(records[0].level, 40);
});

test('silent log level suppresses output while preserving responses and request IDs', async (t) => {
  const capture = captureServer(t, { logLevel: 'silent' });
  const response = await capture.app.inject({ method: 'GET', url: '/api/ping' });
  await capture.app.inject({ method: 'GET', url: '/missing' });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, 'pong');
  assert.match(response.headers['x-request-id'], UUID);
  assert.equal(capture.output(), '');
});

test('invalid log levels fail with a configuration error', () => {
  assert.throws(() => buildServer({ logLevel: 'verbose' }), /LOG_LEVEL/);
});
