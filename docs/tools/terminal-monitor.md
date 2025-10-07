# Terminal Monitor (neo-blessed)

> Task 0018 — aligns with SEC §0.1 platform guidance and SEC §11.3 transport policy.

## Overview

The terminal monitor is a read-only dashboard built on **neo-blessed** that
subscribes to the Socket.IO telemetry namespace. It surfaces workforce KPIs,
maintenance advisories, cultivation health warnings, and hourly labour cost
signals without emitting any intents or commands. The monitor honours the
Simulation Engine Contract (SEC) determinism and read-only requirements while
providing a quick-look operational view aligned with the experience pillar in
`VISION_SCOPE §1`.

## Running the monitor

```bash
pnpm monitor:terminal [--base-url=http://host:port] [--refresh-ms=1000]
```

- The CLI automatically appends `/telemetry` to the provided base URL and only
  listens to the read-only namespace. No commands are sent upstream.
- Environment overrides:
  - `WB_MONITOR_BASE_URL` — default telemetry host (defaults to
    `http://127.0.0.1:4000`).
  - `WB_MONITOR_REFRESH_MS` — deterministic refresh cadence in milliseconds
    (defaults to `1000`).
- Keyboard navigation: use `←/→` (or `Tab/Shift+Tab`) to move between panels and
  `q` / `Esc` / `Ctrl+C` to exit. The UI never enables text input fields so
  telemetry remains receive-only.

## Panels & KPIs

The monitor renders five panes refreshed on a deterministic cadence and in
response to incoming telemetry events:

1. **Status** — connection state, active endpoint, and the most recent telemetry
   parsing error (if any).
2. **Workforce** — latest KPI snapshot (queue depth, utilisation, maintenance
   backlog, morale/fatigue) and live warnings emitted by the scheduling stage.
3. **Environment & Health** — pest/disease warnings, highest observed risk, and
   an energy status banner (currently "awaiting telemetry" until energy topics
   are emitted by the engine).
4. **Maintenance** — scheduled service visits with hourly commitments and visit
   costs, plus replacement recommendations.
5. **Economy** — labour cost per in-game hour derived from the payroll snapshot
   (per-hour units per SEC/TDD guidance).
6. **Telemetry Log** — the most recent topics received, truncated to 50 rows to
   keep the interface responsive.

Unknown telemetry topics are still logged so future domains can be observed
without code changes.

## Determinism & read-only enforcement

- The monitor relies exclusively on the Socket.IO telemetry namespace published
  by the façade/transport adapter. Any attempt to write would surface a
  `telemetry:error` and is guarded by integration tests.
- Payload schemas are validated with `zod`. Malformed messages surface a
  human-readable error in the status panel without crashing the monitor.
- Costs are normalised to per-hour figures, matching SEC §3.6 and TDD §0/§5
  requirements. No `per_tick` units are introduced.

## Tests

- **Unit (`tests/unit/monitorRuntime.test.ts`)** — exercises the runtime store
  and verifies that workforce telemetry updates the view model while schema
  errors are surfaced deterministically.
- **Integration (`tests/integration/terminalMonitor.integration.test.ts`)** —
  boots a Socket.IO harness, runs the monitor against it, and asserts that
  telemetry flows without triggering read-only violations.

These suites gate Task 0018 and keep the tool aligned with SEC v0.2.1 semantics.
