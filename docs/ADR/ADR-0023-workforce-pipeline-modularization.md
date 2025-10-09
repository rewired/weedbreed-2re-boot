# ADR-0023: Workforce Pipeline Modularization & Telemetry Isolation

> **Metadata**
>
> - **ID:** ADR-0023
> - **Title:** Workforce Pipeline Modularization & Telemetry Isolation
> - **Status:** Accepted
> - **Date:** 2025-02-21
> - **Supersedes:** _None_
> - **Summary:** Split the monolithic `applyWorkforce` tick stage into cohesive modules and centralize workforce telemetry side-effects per SEC §10/§11.
> - **Binding:** true
> - **Impacts:** SEC, DD, TDD, VISION, AGENTS
>
## Context

`applyWorkforce.ts` had ballooned to 1.6 k LOC, combining intent routing, hiring market logic, trait math, scheduling, payroll accrual, and telemetry emission. The coupling made it difficult to reason about side-effects, to audit SEC §10 invariants, or to extend any individual concern without risking regressions elsewhere. Telemetry calls were scattered through the tick stage, complicating efforts to monitor workforce KPIs and to keep the telemetry bus write-only as mandated by SEC §11. The AGENTS guardrails also require files to stay below 500 LOC.

## Decision

- Introduce a dedicated `packages/engine/src/backend/src/workforce/**` module tree:
  - `scheduler/dispatch.ts` implements deterministic candidate scoring, dispatch rotation, and assignment recording.
  - `payroll/accrual.ts` handles banker’s rounding, structure rollups, and day-boundary finalization.
  - `market/candidates.ts` encapsulates hiring scans, cooldown accounting, and candidate → employee materialization.
  - `traits/effects.ts` captures task duration/error multipliers plus fatigue/morale adjustments.
  - `intents/*.ts` process raise/bonus/ignore decisions and termination ripples without mutating world state directly.
  - `telemetry/workforceEmit.ts` batches every workforce-related emit so the orchestrator remains side-effect free apart from a single telemetry call.
- Replace the monolithic pipeline entry point with a slim orchestrator (`workforce/index.ts`) that wires the pure functions together, records runtime state on the engine context, and ensures `applyWorkforce.ts` re-exports only the high-level API.
- Maintain compatibility with existing integration suites (scheduler, payroll, telemetry) by preserving the public runtime helpers (`ensureWorkforceRuntime`, payroll accrual consumers, market charge drain) and routing their implementations through the new modules.

## Consequences

### Positive

- Workforce logic is testable in isolation; each concern has a single-responsibility module well below the 500 LOC ceiling.
- Telemetry emissions now flow through one batching function, making it straightforward to audit SEC §11 read-only guarantees and to expand KPI coverage.
- Future features (e.g., alternative schedulers or payroll adjustments) can evolve by extending focused modules without revisiting a thousand-line switchboard.
- Context helpers (runtime, accrual, market charges) remain intact, so downstream code consumes the same API with clearer implementation boundaries.

### Negative

- Developers must learn the new module boundaries; cross-cutting changes may require edits across several files instead of one large function.
- Some historical git blame context on `applyWorkforce.ts` is reset because the orchestration was rewritten as a façade over the new modules.

### Follow-up

- Add dedicated unit suites for the newly extracted modules (scheduler, market, telemetry batcher) to prevent regressions outside integration coverage.
- Revisit workforce trait catalogues to provide golden vectors for the `traits/effects.ts` helpers, ensuring trait math remains deterministic across refactors.

