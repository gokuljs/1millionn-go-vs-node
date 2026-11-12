'use strict';

const Fastify = require('fastify');
const PAYLOAD = Buffer.alloc(1024, 0x78);

function buildServer() {
  const app = Fastify({ logger: false });

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
    const address = await app.listen({ host, port });
    console.log(`Listening on ${address}`);
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
