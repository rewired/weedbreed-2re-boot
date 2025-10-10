# Deterministic String Formatting

**ID:** 0063
**Status:** Planned
**Owner:** codex
**Priority:** P1
**Tags:** engine, lint, formatting

## Rationale
`restrict-template-expressions`, `no-base-to-string`, and `no-useless-escape` issues (16 findings) reveal implicit string coercion and brittle formatting in pipeline reporting. This threatens deterministic telemetry and violates SEC output policy.

## Scope
- In: Files mapped to `string-format-safety`, notably `cultivation/methodRuntime.ts`, `engine/conformance/builder/worldBuilder.ts`, CLI reporters, and related tests.
- Out: UI formatting utilities.

## Deliverables
- Introduce explicit formatting helpers (e.g. `formatTemperatureC`, `formatHumidityDelta`) and replace ad-hoc interpolation.
- Remove redundant escapes; convert to template literals or raw strings.
- Ensure formatted output annotates units consistently.
- Update tests/snapshots covering string output.

## Acceptance Criteria
- `pnpm -r lint --max-warnings=0` clears all `restrict-template-expressions`, `no-base-to-string`, and `no-useless-escape` findings on scoped files.
- Telemetry/readout tests assert deterministic string output with units.
- Formatting helpers documented (inline JSDoc) referencing SEC §6 (Power↔Heat coupling expectations) where relevant.

## References
- SEC v0.2.1 §6 (Telemetry & reporting expectations)
- AGENTS.md §6 (Power/heat coupling) & §15 (documentation)
- reports/batch-03/supervisor/task-matrix.json → `string-format-safety`
