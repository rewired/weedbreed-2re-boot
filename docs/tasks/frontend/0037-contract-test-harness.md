# Contract Test Harness

**ID:** 0037
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, tests, ci, track-6

## Rationale
Cross-package contract tests must validate transport semantics, read-model schemas, and telemetry topics end-to-end. Establishing a harness now provides confidence before UI integration and supports CI automation.

## Scope
- In: set up a Vitest (or Playwright) contract suite under `packages/facade/tests/contract` spinning up façade HTTP + transport server.
- In: verify read-model endpoints return schema-valid payloads, telemetry namespace rejects writes, and intents produce expected acks.
- Out: UI rendering checks (handled elsewhere).

## Deliverables
- Contract test files (e.g., `transport.contract.spec.ts`, `readModels.contract.spec.ts`) under `packages/facade/tests/contract/`.
- Helper scripts in `packages/facade/tests/contract/utils/server.ts` to start/stop servers for tests.

## Acceptance Criteria
- Contract suite runs via `pnpm --filter @wb/facade test:contract` (new script) and passes locally.
- Tests assert telemetry read-only rejection, ack structure, and read-model schema compliance using validators from Task 0023.
- Test harness cleans up servers to avoid port leaks.

## References
- [Proposal §5](../../proposals/20251009-mini_frontend.md#5-thin-transport-slice-mvp-wiring)
- [Proposal §7](../../proposals/20251009-mini_frontend.md#7-acceptance-criteria-mvp)
- [TDD §11](../../TDD.md#11-telemetry-read-only-transport-separation-sec-11)
