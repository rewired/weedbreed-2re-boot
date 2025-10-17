# Deterministic World Loader

**ID:** 1100
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** backend, read-model, data

## Rationale
Replacing the placeholder demo harness with a deterministic loader seeded from real blueprints and fixtures is essential for exercising live read-model hydration across subsequent tasks.

## Scope
- In: implement a new deterministic content loader that composes SimulationWorld data from parseCompanyWorld, blueprint catalogs, price maps, and workforce fixtures.
- In: ensure loader seeding is configurable (seed string) and produces repeatable world snapshots for tests.
- Out: no UI changes; backend-only modifications.
- Out: no mutation of blueprint JSON in /data at runtime.
- Rollback: reinstate the previous demo harness and remove loader registrations.

## Deliverables
- New loader module under packages/façade or equivalent backend path, replacing createDemoWorld usage.
- Unit tests validating deterministic outputs for at least two seed values.
- Documentation comment in docs/CHANGELOG.md noting loader introduction.

## Acceptance Criteria
- Max 3 source files touched (excluding tests) and ≤150 diff lines overall.
- Loader assembles at least two structures with multiple rooms/zones/devices/workforce members per SEC §2 hierarchy.
- Vitest unit tests (`pnpm test --filter loader`) verifying deterministic snapshots (hash or deep equality) for fixed seeds; 1–3 tests added.
- No new external dependencies introduced.
- Tests to add/modify: 2 unit tests covering seed determinism and blueprint integration.

## References
- SEC §2 hierarchy rules, §5 economics
- TDD §2 world loading
- Root AGENTS.md §2 (Determinism) & §5 (Blueprint handling)
