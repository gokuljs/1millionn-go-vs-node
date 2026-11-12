'use strict';

const Fastify = require('fastify');

function buildServer() {
  const app = Fastify({ logger: false });

  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/api/ping', async (_request, reply) => {
    return reply.type('text/plain').send('pong');
  });

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
