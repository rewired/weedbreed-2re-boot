# ADR-0024: Conformance Golden Scenario Modularization

> **Metadata**
>
> - **ID:** ADR-0024
> - **Title:** Conformance Golden Scenario Modularization
> - **Status:** Accepted
> - **Date:** 2025-03-23
> - **Supersedes:** _None_
> - **Summary:** Break the monolithic conformance scenario generator into cohesive modules (recipes, builder, fixtures I/O, hash verification) while keeping the exported API and golden fixtures stable.
> - **Binding:** true
> - **Impacts:** SEC, DD, TDD, AGENTS

## Context

`packages/engine/src/backend/src/engine/conformance/goldenScenario.ts` had grown to ~800 LOC. It blended blueprint imports, room/zone/employee presets, RNG helpers, daily hash logic, world topology assembly, and fixture file writing assertions. The size violated the AGENTS guardrail to keep files under 500 LOC and made it difficult to reason about deterministic guarantees required by SEC §6a (daily hashes, summary hash) or to update individual concerns without rerunning the entire scenario script. The monolithic layout also duplicated fixture I/O helpers that `runDeterministic.ts` needed, leading to tightly coupled utilities.

## Decision

- Extract dedicated modules under `engine/conformance`:
  - `recipes/` hosts immutable presets (`rooms.ts`, `zones.ts`, `employees.ts`) and re-exports blueprint imports so recipe files stay declarative.
  - `builder/worldBuilder.ts` composes presets, RNG helpers, and lifecycle bookkeeping into the `buildGoldenScenarioRun` implementation.
  - `verify/hashes.ts` centralizes tolerance constants and canonical hash helpers used by the builder and tests.
  - `fixtures/io.ts` exposes reusable read/write + assertion helpers for deterministic fixture management reused by `runDeterministic.ts`.
  - `blueprintImports.ts` loads JSON blueprint data once and shares the typed constants across recipes.
- Reduce `goldenScenario.ts` to an API surface that re-exports `generateGoldenScenarioRun` (backed by the builder) plus the public types and tolerances consumed by tests.
- Update `runDeterministic.ts` to consume the shared fixture helpers, preserving artifact paths and assertion semantics.
- Keep 30-day and 200-day golden master hashes intact by preserving computation order and deterministic RNG seeding.

## Consequences

### Positive

- Each concern now fits within focused modules (<200 LOC each), aligning with AGENTS guardrails and improving readability.
- Fixture I/O and hash helpers are reusable and tested indirectly by existing golden master suites without duplicating code.
- Scenario presets (rooms, zones, employees) are easier to audit or extend independently of world-building logic.
- The public API for consumers (`generateGoldenScenarioRun`, exported types, EPS tolerances) remains unchanged, so downstream tests and tooling require no updates.

### Negative

- Additional modules increase the number of imports to maintain; contributors must understand the new layout before modifying the scenario.
- Blueprint constants now live in `blueprintImports.ts`, so recipe changes that require new blueprints must update that central file before presets compile.

## Status

Accepted — implementation complete, golden hashes verified for 30-day and 200-day runs.
