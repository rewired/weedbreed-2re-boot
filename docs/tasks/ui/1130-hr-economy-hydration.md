# HR & Economy Hydration

**ID:** 1130
**Status:** Planned
**Owner:** unassigned
**Priority:** P2
**Tags:** backend, workforce, economy

## Rationale
Workforce and finance surfaces need real rosters, utilization, and balance data derived from the deterministic world to replace synthetic placeholders.

## Scope
- In: extend read-model providers to populate workforce directory, assignment timelines, and economy balance/delta fields.
- In: compute strain catalog endpoint if required to support Phase 4 UI work.
- Out: telemetry event publishing (Phase 2) and UI selectors (Phase 4).
- Out: introduction of new external dependencies.
- Rollback: revert provider changes and associated endpoints.

## Deliverables
- Updated provider modules for workforce/economy plus optional strain catalog endpoint definitions.
- Unit tests validating workforce counts, utilization percentages, and balance calculations.
- CHANGELOG entry referencing workforce/economy hydration.

## Acceptance Criteria
- ≤3 source files (plus tests) modified with ≤150 diff lines.
- Workforce read model includes roster with assignments, warnings, and utilization derived from deterministic world data.
- Economy read model exposes balance, daily delta, and tariff references consistent with SEC §3.
- Strain catalog (if added) returns deterministic cultivar metadata.
- Tests to add/modify: 3 unit tests (workforce roster, economy totals, optional strain endpoint).

## References
- SEC §3 economy, §7 workforce tasks
- DD §3 workforce modelling
- Root AGENTS.md §§5, 6a (interface stacking) & §15
