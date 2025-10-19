# Dev Stack Notes

## Continuous Integration expectations

Frontend and transport contributions must remain green in CI. Every push and
pull request runs on Node.js 22 with pnpm 10.18.1 and executes:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm --filter @wb/facade test:contract
```

Keep workspace scripts aligned with these commands so CI matches the workflow
documented in TDD §2.

## Façade Read-Model Server Bootstrap

The façade's Fastify server publishes read models for the UI and tooling.
Launch it locally with:

```bash
pnpm --filter @wb/facade dev:server
```

The server listens on `0.0.0.0:3333` by default and logs the public URL as
`http://localhost:3333`. Override the port with `FACADE_HTTP_PORT` before
starting the process.

## Façade Transport Server Bootstrap

The façade exposes a Socket.IO transport server that brokers telemetry and intent
traffic. For local development you can launch the server with:

```bash
pnpm --filter @wb/facade transport:dev
```

By default the script binds to `127.0.0.1:7101`, enables CORS for
`http://localhost:5173`, and prints the `/healthz` endpoint URL to the console.
Adjust behaviour via the following environment variables:

- `FACADE_TRANSPORT_HOST` — optional host override (defaults to `127.0.0.1`).
- `FACADE_TRANSPORT_PORT` — positive integer port override (defaults to `7101`).
- `FACADE_TRANSPORT_CORS_ORIGIN` — CORS origin forwarded to Socket.IO and the
  health endpoint (defaults to `http://localhost:5173`).

The server currently exposes the `/telemetry` (read-only) and `/intents`
namespaces. Intents are normalised against the façade's workforce command
pipeline: valid submissions queue engine intents, advance the simulation by one
deterministic tick, and acknowledge with `{ ok: true }`. Payload validation
failures or unsupported intent types reject with
`WB_INTENT_HANDLER_ERROR` acknowledgements, mirroring the Socket.IO contract
described in SEC/TDD. Shutdown is triggered via `SIGINT`/`SIGTERM`.

## UI Dev Server Configuration

`pnpm run dev:stack` now injects façade defaults into the Vite dev server when
the corresponding `VITE_*` variables are absent: `http://localhost:3333` for the
read-model HTTP base and `http://localhost:7101` for the Socket.IO transport.
Persist custom endpoints by copying `packages/ui/.env.example` to
`packages/ui/.env.local` (or exporting values in your shell) before launching the
stack.
