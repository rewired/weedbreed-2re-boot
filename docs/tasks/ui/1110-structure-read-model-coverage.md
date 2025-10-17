# Structure Read-Model Coverage

**ID:** 1110
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** backend, read-model

## Rationale
Live dashboards require read-model providers that compute real coverage, KPIs, climate snapshots, and economy totals instead of zeroed placeholders.

## Scope
- In: extend createReadModelProviders (or equivalent) to derive structure-level metrics (coverage, KPIs, economy aggregates) from the deterministic world loader.
- In: include normalization/deep-freeze of the enriched payload prior to transport exposure.
- Out: no UI store modifications.
- Out: no telemetry publishing changes (handled in Phase 2 tasks).
- Rollback: revert provider changes and restore placeholder metrics if regressions appear.

## Deliverables
- Updated provider module computing structure KPIs using engine subsystems.
- Unit tests validating computed metrics for at least one deterministic world snapshot.
- CHANGELOG note referencing metric hydration.

## Acceptance Criteria
- ≤3 source files edited (plus test file) and ≤150 diff lines.
- Provider returns non-zero coverage, KPI, and economy data consistent with deterministic loader outputs.
- Tests (1–3) assert expected numeric results with tolerance per SEC (EPS_REL 1e-6).
- No new dependencies introduced.
- Tests to add/modify: 2 unit tests verifying KPIs and normalization.

## References
- SEC §2 hierarchy, §5 economy
- TDD §4 read-model normalization
- Root AGENTS.md §2 determinism, §15 acceptance criteria
