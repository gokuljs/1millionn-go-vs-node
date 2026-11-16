'use strict';

const http = require('node:http');
const https = require('node:https');
const { performance } = require('node:perf_hooks');

// Usage: node scripts/load-test.js <url> [requests=1000000] [concurrency=50]
async function main() {
  const [target, countArg = '1000000', concurrencyArg = '50'] = process.argv.slice(2);
  if (!target || target === '--help') {
    console.log('Usage: node scripts/load-test.js <url> [requests=1000000] [concurrency=50]');
    process.exitCode = target ? 0 : 1;
    return;
  }

  const url = new URL(target);
  const total = Number(countArg);
  const concurrency = Math.min(Number(concurrencyArg), total);
  if (!['http:', 'https:'].includes(url.protocol) ||
      !Number.isSafeInteger(total) || total < 1 ||
      !Number.isSafeInteger(Number(concurrencyArg)) || Number(concurrencyArg) < 1) {
    throw new Error('Use an HTTP(S) URL and positive integers for requests and concurrency.');
  }

  const client = url.protocol === 'https:' ? https : http;
  const agent = new client.Agent({ keepAlive: true, maxSockets: concurrency });
  const latencies = new Float64Array(total); // About 8 MB for one million attempts.
  const statuses = {};
  const errors = {};
  let started = 0;
  let completed = 0;
  let succeeded = 0;
  let stopping = false;
  const begin = performance.now();

  function get() {
    return new Promise((resolve, reject) => {
      const req = client.get(url, { agent }, (res) => {
        res.resume(); // Consume the body so the connection can be reused.
        res.once('end', () => resolve(res.statusCode));
        res.once('error', reject);
      });
      const timeout = setTimeout(() => {
        req.destroy(Object.assign(new Error('Request timed out'), { code: 'ETIMEDOUT' }));
      }, 10000);
      req.once('close', () => clearTimeout(timeout));
      req.once('error', reject);
    });
  }

  async function worker() {
    while (!stopping && started < total) {
      started++;
      const before = performance.now();
      try {
        const status = await get();
        statuses[status] = (statuses[status] || 0) + 1;
        if (status >= 200 && status < 300) succeeded++;
      } catch (error) {
        const code = error.code || 'UNKNOWN';
        errors[code] = (errors[code] || 0) + 1;
      }
      latencies[completed++] = performance.now() - before;
    }
  }

  const stop = () => {
    stopping = true;
    console.log('\nStopping new requests; waiting for in-flight requests to finish.');
  };
  process.once('SIGINT', stop);
  console.log(`Start: ${new Date().toISOString()}`);
  console.log(`GET ${url.href} | ${total} requests | concurrency ${concurrency} | timeout 10s`);
  let lastCompleted = 0;
  let lastTime = begin;
  const progress = setInterval(() => {
    const now = performance.now();
    const rps = (completed - lastCompleted) / ((now - lastTime) / 1000);
    console.log(`${completed}/${total} completed | ${rps.toFixed(1)} req/s | ${completed - succeeded} failed`);
    lastCompleted = completed;
    lastTime = now;
  }, 5000);

  try {
    // Only this many workers exist; we do not create one million simultaneous requests.
    await Promise.all(Array.from({ length: concurrency }, worker));
  } finally {
    clearInterval(progress);
    agent.destroy();
    process.removeListener('SIGINT', stop);
  }

  const seconds = (performance.now() - begin) / 1000;
  const sorted = latencies.subarray(0, completed).sort();
  const percentile = (p) => completed ? sorted[Math.ceil(p * completed) - 1].toFixed(2) : 'n/a';
  console.log(`End: ${new Date().toISOString()}`);
  console.log(`Completed: ${completed} | Success (2xx): ${succeeded} | Failed: ${completed - succeeded}`);
  console.log(`Duration: ${seconds.toFixed(2)}s | Average throughput: ${(completed / seconds).toFixed(1)} req/s`);
  console.log(`Latency, all attempts: p50=${percentile(0.50)}ms p95=${percentile(0.95)}ms p99=${percentile(0.99)}ms`);
  console.log(`HTTP statuses: ${JSON.stringify(statuses)} | Network errors: ${JSON.stringify(errors)}`);
  process.exitCode = stopping ? 130 : completed === succeeded ? 0 : 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
