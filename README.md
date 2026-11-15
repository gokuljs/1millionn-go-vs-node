# Node.js vs Go HTTP experiments

This repository will compare separate Node.js and Go HTTP servers using the same request workloads. The Node.js server comes first; Go code and measured results will be added later.

## Node.js server

The Fastify server lives in [`nodejs/`](nodejs/). It requires Node.js 20 or newer and serves plain HTTP. From the repository root:

```sh
cd nodejs
npm ci
npm start
```

It listens on `127.0.0.1:3000` by default. Set `HOST` and `PORT` to change the bind address, for example `HOST=0.0.0.0 PORT=3001 npm start`. Run the route and logging tests with `npm test` from `nodejs/`.

## API logging

Fastify's built-in Pino logger writes newline-delimited JSON to stdout. At the default `info` level, each completed application request, including `/healthz`, produces one `request completed` record with:

- `time`: Unix timestamp in milliseconds.
- `reqId`: a server-generated UUID, also returned in the `x-request-id` response header. Client-supplied request IDs are ignored.
- `method` and `route`: the HTTP method and registered route template; unmatched routes use `null`.
- `statusCode` and `responseTime`: the response status and server-side elapsed time in milliseconds.
- `error.type` and, when present, `error.code`: diagnostic metadata for handled errors.

Successful responses are logged at `info`, 4xx responses at `warn`, and 5xx responses at `error`. Pino represents these levels numerically in JSON (`30`, `40`, and `50`). Request headers, query values, path parameter values, request/response bodies, and raw error messages or stacks are excluded from these automatic request records. Keep secrets out of any custom log messages added later.

Framework error serialization also keeps only the error type and code, excluding raw HTTP packets. Requests rejected before Fastify's application lifecycle, such as malformed URLs, may have no completion record or `x-request-id` response header.

For example, start the server and make a request in another terminal:

```sh
curl -i http://127.0.0.1:3000/api/ping
```

The response contains `pong` and an `x-request-id` header. The corresponding server log looks like this (additional Pino process fields omitted):

```json
{"level":30,"time":1794729600000,"reqId":"5e6b73c1-b2f8-4d1c-a780-d530dc84cefa","method":"GET","route":"/api/ping","statusCode":200,"responseTime":0.42,"msg":"request completed"}
```

`LOG_LEVEL` defaults to `info` and accepts `trace`, `debug`, `info`, `warn`, `error`, `fatal`, or `silent`. Invalid values fail startup. For example:

```sh
LOG_LEVEL=warn npm start
LOG_LEVEL=silent npm start
```

`warn` keeps warning/error records while filtering successful request records. `silent` suppresses Pino output, including normal startup logs, but request IDs and logging hooks still run; it does not remove all instrumentation overhead. Record the log level with benchmark results. Startup configuration failures are reported to stderr.

These logs remain local until container log forwarding is configured. CloudWatch infrastructure and shipping are a later step.

## Endpoint contract

These fixed responses define the initial workloads for a later Go server. `/healthz` is a readiness check, not a benchmark workload.

| Method | Path | Success response |
| --- | --- | --- |
| GET | `/healthz` | `200` JSON `{"status":"ok"}` |
| GET | `/api/ping` | `200` plain text `pong` |
| GET | `/api/json` | `200` JSON `{"message":"ok"}` |
| GET | `/api/payload` | `200` binary body: exactly 1,024 `x` bytes |
| POST | `/api/echo` | `200` JSON object matching the request body |

`POST /api/echo` accepts JSON objects up to 64 KiB. It returns `400` for other JSON types and `413` for an oversized body.

Example requests after starting the server:

```sh
curl http://127.0.0.1:3000/healthz
curl http://127.0.0.1:3000/api/ping
curl http://127.0.0.1:3000/api/json
curl -o /dev/null -w '%{size_download}\n' http://127.0.0.1:3000/api/payload
curl -H 'content-type: application/json' -d '{"message":"hello"}' http://127.0.0.1:3000/api/echo
```

The package lockfile pins `light-my-request` to a Node.js 20-compatible release; newer releases pull a `cookie` version that requires Node.js 22. No throughput or capacity claim is made before a workload and environment are measured and recorded.
