# Task 0003 — Golden Master Conformance Suite

## Objective
Establish the deterministic conformance harness described in SEC §0.2 and TDD §12 so regressions are caught through daily hash comparisons on the reference savegame.

## Acceptance Criteria
- ✅ Provide a headless harness that advances the nine-phase tick pipeline for the canonical world seed and surfaces daily metrics/hashes.
- ✅ Ship fixtures for 7-day and 30-day runs (`summary_v1_7d.json`, `daily_v1_7d.json`, `summary_v1_30d.json`, `daily_v1_30d.json`).
- ✅ Enforce hashes and metric parity via Vitest conformance specs.
- ✅ Keep RNG deterministic via `createRng(seed, streamId)` (no `Math.random`).

## Deliverables
- `packages/engine/src/engine/testHarness.ts` with deterministic loop, tariff handling, and canonical hashing.
- Generated fixture set under `packages/engine/tests/fixtures/golden/`.
- `packages/engine/tests/conformance/goldenMaster.spec.ts` asserting 7-day and 30-day stability.
- Workspace/tooling scaffolding (`pnpm-workspace.yaml`, TypeScript, ESLint, Vitest) so conformance jobs run via `pnpm -r test`.

## Verification
- `pnpm -r lint`
- `pnpm -r build`
- `pnpm -r test`

## Status
- Completed via WB-013 on 2025-10-07. Golden outputs generated with seed `gm-001`.
