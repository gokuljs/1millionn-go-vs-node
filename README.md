# Node.js vs Go HTTP experiments

This repository will compare separate Node.js and Go HTTP servers using the same request workloads. The Node.js server comes first; Go code and measured results will be added later.

## Node.js server

The Fastify server lives in [`nodejs/`](nodejs/). It requires Node.js 20 or newer and serves plain HTTP. From the repository root:

```sh
cd nodejs
npm ci
npm start
```

It listens on `127.0.0.1:3000` by default. Set `HOST` and `PORT` to change the bind address, for example `HOST=0.0.0.0 PORT=3001 npm start`. Request logging is disabled so it does not add work to each request. Run the route tests with `npm test` from `nodejs/`.

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
