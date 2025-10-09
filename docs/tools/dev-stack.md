# Dev Stack Notes

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
namespaces. Intents are accepted but not processed until downstream tracks wire
an intent handler. Shutdown is triggered via `SIGINT`/`SIGTERM`.
