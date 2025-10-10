# Unsafe Dynamic Types Hardening

**ID:** 0060
**Status:** Planned
**Owner:** codex
**Priority:** P0
**Tags:** engine, lint, typing, blueprints

## Rationale
Blueprint loaders and integration suites still operate on `any` values, producing 139 `@typescript-eslint/no-unsafe-*` failures. These mask schema regressions and violate SEC §1 determinism guarantees.

## Scope
- In: `packages/engine/src/backend/src/domain/**`, pipeline services, and engine integration/unit tests listed under cluster `unsafe-dynamic-types` in `task-matrix.json`.
- In: Update blueprint/device parsers, workforce identity services, and economy/perf scenarios to emit strongly typed objects.
- Out: UI packages, transport adapters, or unrelated tooling.

## Deliverables
- Replace `any`/loosely typed unions with Zod-validated DTOs and discriminated unions.
- Adjust affected tests to consume typed factories (no inline casts).
- Update supporting helpers (`identitySource`, `perfScenarios`, blueprint schema tests) to match new types.
- Document new schema helpers if necessary.

## Acceptance Criteria
- `pnpm -r lint --max-warnings=0` passes with all `no-unsafe-*` and `no-explicit-any` findings resolved for assigned files.
- `pnpm -r typecheck` (once scripts exist) or equivalent workspace type build is clean.
- `pnpm -r test` remains green with additional coverage validating schema parsing.
- No new `any` or `unknown` escapes without explicit guards; SEC §1 determinism upheld.

## References
- SEC v0.2.1 §1 (Determinism, schema enforcement)
- AGENTS.md §5 (Blueprint taxonomy & validation)
- reports/batch-03/supervisor/task-matrix.json → `unsafe-dynamic-types`
