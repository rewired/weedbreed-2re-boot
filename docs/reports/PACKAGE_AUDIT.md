# Package Audit & Reporting Matrix

_Generated via `pnpm report:packages` — deterministic snapshot of candidate tooling dependencies._

## Scope & Inputs

- Parsed `package.json` for the root workspace and `packages/*` (pnpm workspaces).
- Parsed `pnpm-lock.yaml` to resolve locked versions per importer.
- Searched `packages/*/src/**` for direct imports/requires of candidate packages.
- Classified candidates into Greenlist / Review / Skip buckets with rationale.

## Findings

| Package | Wanted | Installed? | Version(s) | Location(s) | Direct Usage?* | Category | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `uuid` | `^9` | ✅ | `13.0.0` | @wb/engine (dependencies) | @wb/engine: packages/engine/src/shared/determinism/ids.ts | Greenlist | Existing sha256-based deterministicUuid helper lives under packages/engine/src/backend/src/util/uuid.ts.<br>Deterministic scaffolds only; keep parity with existing helpers before touching runtime flows.<br>Installed range diverges from prompt target; verify before rollout. |
| `xxhash-wasm` | `^1` | ✅ | `1.1.0` | @wb/engine (dependencies) | @wb/engine: packages/engine/src/shared/determinism/hash.ts | Greenlist | Current release exposes 64-bit helpers only; 128-bit hash composed via dual seeds.<br>Test-only hashing helper; aligns with deterministic checksum scaffolds without runtime hooks yet. |
| `safe-stable-stringify` | `^2` | ✅ | `2.5.0` | @wb/engine (dependencies) | @wb/engine: packages/engine/src/backend/src/engine/conformance/goldenScenario.ts<br>@wb/engine: packages/engine/src/backend/src/engine/conformance/runDeterministic.ts<br>@wb/engine: packages/engine/src/backend/src/saveLoad/saveManager.ts<br>@wb/engine: packages/engine/src/shared/determinism/hash.ts | Greenlist | Used for canonical JSON hashing in tests; no production wiring planned until determinism ADR. |
| `globby` | `^14` | ✅ | `14.1.0` | @wb/tools (dependencies) | @wb/tools: packages/tools/src/lib/packageAudit.ts | Greenlist | Tooling helper only; drives report discovery without impacting runtime bundles. |
| `psychrolib` | `^2` | ❌ | — | — | — | Review | Upstream npm only publishes v1.x today; monitor for v2 cut.<br>Hold for v2 upstream release (or vetted fork) before wiring psychrometrics into the pipeline. |
| `mathjs` | `^13` | ❌ | — | — | — | Skip | Defer until we formalise tree-shaking and bundle footprint guardrails. |
| `@turf/turf` | `^7` | ❌ | — | — | — | Skip | Spatial tooling is future-facing; no geometry ADR approved yet. |
| `zod-to-json-schema` | `^3` | ❌ | — | — | — | Skip | Schema export automation can wait until façade contracts stabilise. |
| `type-fest` | `^4` | ❌ | — | — | — | Skip | Additional TS utility types not required for current contracts. |
| `rxjs` | `^7` | ❌ | — | — | — | Skip | Reactive stream layer unscheduled; existing event emitters cover needs. |
| `mitt` | `^3` | ❌ | — | — | — | Skip | Redundant to current event emitter options; leave out until event bus ADR. |
| `eventemitter3` | `^5` | ❌ | — | — | — | Skip | Hold until we benchmark emitter stacking for the façade/transport boundary. |
| `commander` | `^12` | ✅ | `12.1.0` | @wb/tools (dependencies) | @wb/tools: packages/tools/src/cli/report.ts | Greenlist | CLI framework limited to tooling scope; deterministic for reports. |
| `pino` | `^9` | ✅ | `9.13.1` | @wb/tools (dependencies) | @wb/tools: packages/tools/src/lib/logger.ts | Greenlist | Structured logging for tooling only; production stack remains unchanged. |
| `pino-pretty` | `^11` | ✅ | `11.3.0` | @wb/tools (dependencies) | — | Review | Keep pretty transport opt-in so CI logs stay terse. |
| `cli-table3` | `^0.6` | ✅ | `0.6.5` | @wb/tools (dependencies) | @wb/tools: packages/tools/src/cli/report.ts | Greenlist | Console formatting helper scoped to reports only. |
| `fast-check` | `^3` | ✅ | `3.23.2` | @wb/engine (devDependencies) | — | Greenlist | Property testing library stays confined to tests. |
| `vitest-fetch-mock` | `^0.4` | ❌ | — | — | — | Skip | Facade tests do not require fetch mocking yet; evaluate alongside transport work. |
| `msw` | `^2` | ❌ | — | — | — | Skip | Network mocking remains out-of-scope until UI transport harness matures. |
| `neo-blessed` | `^0.2` | ❌ | — | — | — | Skip | Terminal monitor deferred; revisit during monitoring sprint.<br>Optional monitor tooling; defer until terminal UX sprint. |
| `blessed-contrib` | `^5` | ❌ | — | — | — | Skip | Depends on the terminal monitor initiative; skip for now.<br>Optional monitor tooling; defer until terminal UX sprint. |

> *Direct usage = imports/requires within `packages/*/src/**`.

## Greenlist

- `uuid` — Deterministic scaffolds only; keep parity with existing helpers before touching runtime flows.
- `xxhash-wasm` — Test-only hashing helper; aligns with deterministic checksum scaffolds without runtime hooks yet.
- `safe-stable-stringify` — Used for canonical JSON hashing in tests; no production wiring planned until determinism ADR.
- `globby` — Tooling helper only; drives report discovery without impacting runtime bundles.
- `commander` — CLI framework limited to tooling scope; deterministic for reports.
- `pino` — Structured logging for tooling only; production stack remains unchanged.
- `cli-table3` — Console formatting helper scoped to reports only.
- `fast-check` — Property testing library stays confined to tests.

## Review

- `psychrolib` — Hold for v2 upstream release (or vetted fork) before wiring psychrometrics into the pipeline.
- `pino-pretty` — Keep pretty transport opt-in so CI logs stay terse.

## Skip

- `mathjs` — Defer until we formalise tree-shaking and bundle footprint guardrails.
- `@turf/turf` — Spatial tooling is future-facing; no geometry ADR approved yet.
- `zod-to-json-schema` — Schema export automation can wait until façade contracts stabilise.
- `type-fest` — Additional TS utility types not required for current contracts.
- `rxjs` — Reactive stream layer unscheduled; existing event emitters cover needs.
- `mitt` — Redundant to current event emitter options; leave out until event bus ADR.
- `eventemitter3` — Hold until we benchmark emitter stacking for the façade/transport boundary.
- `vitest-fetch-mock` — Facade tests do not require fetch mocking yet; evaluate alongside transport work.
- `msw` — Network mocking remains out-of-scope until UI transport harness matures.
- `neo-blessed` — Terminal monitor deferred; revisit during monitoring sprint.
- `blessed-contrib` — Depends on the terminal monitor initiative; skip for now.

## Follow-up Tasks

- Task 0007 keeps determinism helpers test-only until an ADR approves runtime adoption.
- Task 0009 will cover psychrometric wiring once psychrolib v2 (or alternative) is stable.

## No-Go Criteria

- Introduce runtime UUID/hash replacements without aligning with packages/engine/src/backend/src/util/uuid.ts.
- Adopt psychrolib in production flows before securing a maintained ^2 release or validating 1.x compatibility formally.
- Pull mathjs (or similar heavy dependencies) without a documented tree-shaking plan and bundle budget.
