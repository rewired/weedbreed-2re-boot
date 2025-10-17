# Workforce & Strain UI Binding

**ID:** 4130
**Status:** Planned
**Owner:** unassigned
**Priority:** P2
**Tags:** frontend, workforce, strains

## Rationale
The workforce surface and strains catalog must pull from live read models to display roster utilization and cultivar metadata accurately.

## Scope
- In: update workforce UI selectors/components to consume hydrated read models and intent acknowledgements from Phase 3.
- In: implement Strains page fetching strain catalog read model and rendering cultivar details.
- Out: telemetry subscriptions for workforce events (already handled in Task 4120 testing).
- Out: HR command issuance (handled elsewhere).
- Rollback: revert UI components to fixture data usage.

## Deliverables
- Updated workforce components/hooks using live selectors and acknowledgements.
- Strains page wired to strain catalog read model with deterministic ordering.
- Component tests verifying roster utilization rendering and strain catalog display.
- CHANGELOG entry referencing workforce/strain wiring.

## Acceptance Criteria
- ≤3 component/hook files (plus tests) modified; ≤150 diff lines.
- Workforce UI reflects utilization percentages and warnings from read model within one tick of acknowledgement update.
- Strains page renders deterministic cultivar list matching backend catalog IDs.
- Tests to add/modify: 3 component tests (workforce roster, warning display, strain list).

## References
- SEC §7 workforce, §5 price separation (strain catalog)
- TDD §4 workforce UI
- Root AGENTS.md §§5, 6a
