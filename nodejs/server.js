'use strict';

const Fastify = require('fastify');
const { randomUUID } = require('node:crypto');
const PAYLOAD = Buffer.alloc(1024, 0x78);
const LOG_LEVELS = new Set(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']);

function errorMetadata(error) {
  return { type: error?.name, code: error?.code };
}

function buildServer({ logLevel = process.env.LOG_LEVEL || 'info', logStream } = {}) {
  if (!LOG_LEVELS.has(logLevel)) {
    throw new Error(`LOG_LEVEL must be one of: ${[...LOG_LEVELS].join(', ')}`);
  }

  const app = Fastify({
    logger: {
      level: logLevel,
      stream: logStream,
      // Parser errors can contain raw HTTP packets, messages, and stacks.
      serializers: { err: errorMetadata },
    },
    // Default logs can include raw URLs and error messages containing input.
    logController: new Fastify.LogController({ disableRequestLogging: true }),
    requestIdHeader: false,
    genReqId: () => randomUUID(),
  });

  app.decorateRequest('logError', null);

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.addHook('onError', async (request, _reply, error) => {
    request.logError = errorMetadata(error);
  });

  app.addHook('onResponse', async (request, reply) => {
    const level = reply.statusCode >= 500 ? 'error' : reply.statusCode >= 400 ? 'warn' : 'info';
    request.log[level]({
      method: request.method,
      // Use the registered route template, excluding query values and path parameters.
      route: request.routeOptions.url ?? null,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
      ...(request.logError && { error: request.logError }),
    }, 'request completed');
  });

  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/api/ping', async (_request, reply) => {
    return reply.type('text/plain').send('pong');
  });
  app.get('/api/json', async () => ({ message: 'ok' }));
  app.get('/api/payload', async (_request, reply) => {
    return reply.type('application/octet-stream').send(PAYLOAD);
  });
  app.post('/api/echo', {
    bodyLimit: 64 * 1024,
    schema: {
      body: { type: 'object', additionalProperties: true },
    },
  }, async (request) => request.body);

  return app;
}

async function start() {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const app = buildServer();
  try {
    await app.listen({ host, port });
  } catch (error) {
    await app.close();
    throw error;
  }
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { buildServer };
