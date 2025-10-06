ID: 0007
# Determinism Helper Scaffolds

**ID:** 0002A
**Status:** In Progress
**Owner:** unassigned
**Priority:** P1
**Tags:** backend, determinism, tests

## Rationale
Introduce deterministic hashing/ID scaffolds under `packages/engine/src/shared` so downstream features can adopt proven helpers after design review. Keeping them test-only ensures we respect SEC determinism rules without bypassing existing `deterministicUuid` flows.

## Scope
- Include: asynchronous canonical JSON hash helper using `safe-stable-stringify` + `xxhash-wasm`.
- Include: UUID v7 wrapper + minimal Vitest coverage.
- Out of scope: replacing existing backend UUID utilities or wiring hashes into production pipelines.

## Deliverables
- `hashCanonicalJson` and `newV7` utilities under `packages/engine/src/shared/determinism/`.
- Unit tests covering stability, formatting, and collision guard rails.
- Docs/CHANGELOG entries noting the helpers are test scaffolds only.

## Implementation Steps
1. Create shared determinism directory and implement helpers with documented caveats (dual-seed 128-bit hash, wrapper for uuidv7).
2. Add Vitest coverage verifying canonical stability, formatting, and basic uniqueness.
3. Reference the helpers only from tests to avoid runtime coupling until ADR/go decision.

## Acceptance Criteria / DoD
- Helpers live under `packages/engine/src/shared/determinism/` and export documented functions.
- Vitest unit tests pass and guard stability (ordering invariance, regex match, low collision risk for burst samples).
- Docs (DD/TDD/CHANGELOG) call out the helpers as testing-only scaffolds.

## Tests
- `pnpm --filter @wb/engine test` (covers new unit specs).
