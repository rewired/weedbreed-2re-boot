# Weed Breed — Re‑Reboot (Monorepo)

> **Status:** Active • **Runtime:** Node.js 22 LTS • **Package manager:** pnpm ≥ 10.17 • **Language:** TypeScript (ESM) • **Test:** Vitest • **Repo style:** pnpm workspaces

> **CI coverage:** `pnpm install` → `pnpm lint:ci` → `pnpm test` → `pnpm --filter @wb/facade test:contract` on every push/PR (Node.js 22).

Weed Breed (Re‑Reboot) is a deterministic, tick‑based simulation about controlled‑environment cultivation, resources, and economics. The project emphasizes **reproducibility**, **testability** (Golden Master / Conformance), and **contract‑driven development** via living documents (**SEC**, **TDD**, **DD**, **VISION_SCOPE**).

---

## Key Features

* 🔁 **Deterministic engine** with seeded RNG (reproducible runs).
* 🧪 **Golden Master & Conformance**: long‑run fixtures (e.g., 30d / 200d) and acceptance checks.
* 🧱 **Contracts first**: Engine behavior and tests governed by `/docs/SEC.md`, `/docs/TDD.md`, `/docs/DD.md`, `/docs/VISION_SCOPE.md`.
* 🧩 **Data‑driven blueprints**: strains, devices, structures, rooms, irrigation, substrates, pests/diseases, and more under `/data/blueprints`.
* 💸 **Per‑hour economy**: runtime costs accrue hourly; *_per_tick is **not** used for money.
* 📦 **Monorepo** (pnpm workspaces): clear separation of engine, transport, and tooling.

---

## Monorepo Structure

```
root/
├─ packages/
│  ├─ engine/          # Core simulation engine, pipelines, invariants, tests
│  ├─ facade/          # Thin orchestration / convenience APIs over the engine
│  ├─ transport-sio/   # Transport adapters (e.g., Socket.IO gateway)
│  ├─ tools/           # Dev tooling, linters, scripts, shared configs
│  └─ tools-monitor/   # Minimal monitoring utilities for local runs
├─ data/
│  ├─ blueprints/      # JSON blueprints (strain, device, structure, ...)
│  └─ savegames/       # Canonical savegame location (JSON, schema‑versioned)
├─ docs/
│  ├─ SEC.md           # Simulation Engine Contract (normative behavior)
│  ├─ TDD.md           # Test strategy, conformance, perf & reporting
│  ├─ DD.md            # Design & data flows; SEC wins on conflicts
│  ├─ VISION_SCOPE.md  # Vision, scope, success criteria
│  ├─ CHANGELOG.md     # Keep‑a‑Changelog
│  └─ tasks/           # Implementation tasks for automation agents ("Codex")
└─ pnpm‑workspace.yaml / package.json / .editorconfig / .eslintrc.* / ...
```

---

## Getting Started

### Prerequisites

* **Node.js 22 LTS** (use nvm / volta to pin)
* **pnpm ≥ 10.17** (`corepack enable && corepack prepare pnpm@latest --activate`)

### Install & Build

```sh
pnpm install
pnpm -r build
```

### Run Tests

```sh
# All packages
pnpm -r test

# Focus engine unit/integration tests
pnpm --filter @wb/engine test
```

### Lint & Format

```sh
# Local eslint run keeps warnings visible without failing the run
pnpm -r lint

# CI/strict linting fails on any warning
pnpm lint:ci

pnpm -r format
```

### Run the Mini Frontend Stack

```sh
# Boots façade read-model HTTP server, façade Socket.IO transport, and the Vite UI dev server
pnpm run dev:stack
```

The façade dev server now boots the deterministic engine harness via
`initializeFacade`, composes read-model providers directly from the
simulation world, and exposes live company tree, tariff, workforce, and
aggregated snapshots through the Fastify HTTP endpoints. Restart the stack
after modifying engine bootstrap data to refresh the published payloads.

The script injects façade defaults into the Vite dev server when no overrides
are present: `http://localhost:3333` for the Fastify read-model endpoint and
`http://localhost:7101` for the Socket.IO transport. Persist custom values by
copying `packages/ui/.env.example` to `.env.local` (or exporting them in your
shell) before starting the stack.

### Quick Local Simulation (example)

```sh
# Example script names may vary by package; see each package.json
pnpm --filter @wb/engine sim:run
```

---

## Determinism & RNG

* The engine uses a **seeded RNG** (hash‑seeded stream per subsystem) for **replayable** outcomes.
* **Forbidden:** `Math.random` in production code (lint rule in `packages/tools`).
* Provide a seed via env or run‑options; identical seeds ⇒ identical runs.

---

## Economy Model

* Monetary flows accrue **per hour** (not per tick). This is enforced by tests and docs.
* Physical processes (e.g., ppm/tick, energy/tick) are allowed; **do not** mix monetary units into tick‑based rates.

---

## Data Blueprints

* All gameplay content is JSON under `/data/blueprints`. Typical categories:

  * `strain/`, `device/`, `structure/`, `room/`, `irrigation/`, `substrate/`, `personnel/`, `pest/`, `disease/`, `cultivation-method/`, `container/`.
* Loaders validate and cache blueprints at engine start; tests ensure required fields and stable shapes.

---

## Save / Load & Migrations

* Canonical savegame location: **`/data/savegames`**.
* Save schema is **versioned**; migrations keep older saves compatible.
* Tests cover IO, corrupted headers, forward‑compat no‑ops, and minimal back‑compat fixtures.

---

## Golden Master & Reporting

* Long‑run fixtures (e.g., **30d**, **200d**) validate deterministic behavior.
* Daily JSONL logs and summary JSONs support audits and CI gates.
* The Test/Perf harness produces **ms/tick** metrics for regression catching in CI.

---

## Telemetry (Overview)

* The engine emits structured telemetry events for UI/monitoring tools (e.g., simulation clock, environment samples, harvest/inventory, warnings).
* Consumers (e.g., `packages/tools-monitor`, `transport-sio`) subscribe and forward to UIs.

---

## Scripts (common)

> Check each package's `package.json` for specifics.

* `build` — typecheck & compile
* `test` — unit/integration tests (Vitest)
* `lint` — ESLint rules with warnings surfaced but non-blocking for local workflows
* `lint:ci` — Strict ESLint run (`--max-warnings 0`) for pre-push/CI guardrails
* `perf:ci` — run performance checks for ms/tick regressions

Run in all workspaces: `pnpm -r <script>`.

---

## Contributing

1. Read `/docs/SEC.md`, `/docs/TDD.md`, `/docs/DD.md`, `/docs/VISION_SCOPE.md`.
2. Keep PRs contract‑aligned; if a contract changes, add an **ADR** and update the docs.
3. Add/extend tests with every functional change; do not regress determinism.
4. Update `/docs/CHANGELOG.md` under **Unreleased**.

### Coding Standards

* ESM only, strict TypeScript.
* No side‑effects in import time for simulation state.
* Deterministic RNG only; **no `Date.now()`** in simulation paths (clock is simulated).
* SI units, explicit naming; prefer per‑hour for money, document units for physics.

---

## Roadmap (excerpt)

* Tighten perf budgets & CI gates.
* Expand blueprint validation coverage.
* Telemetry shape reference & consumer guide.
* Editor/UI client (React + Vite + Tailwind components) wiring.

---

## License

TBD.

## Contact / Support

* Issues & discussions via repository tracker.
* For automation agents ("Codex"), use `/docs/tasks/*` and keep outputs contract‑aligned.
