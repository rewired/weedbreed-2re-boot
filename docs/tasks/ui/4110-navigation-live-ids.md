# Navigation Live IDs

**ID:** 4110
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, navigation

## Rationale
Navigation and breadcrumb helpers must derive their structure/room/zone lists from live read models to avoid stale fixture IDs.

## Scope
- In: refactor navigation hooks to consume selectors sourced from the live read-model store.
- In: update resolver helpers to handle missing IDs gracefully and sync with deterministic loader IDs.
- Out: UI styling changes.
- Out: modifications to read-model fetching (handled in Task 4100).
- Rollback: reinstate previous deterministic fixtures for navigation.

## Deliverables
- Updated hooks/utilities deriving navigation data from live store state.
- Component test validating navigation renders correct structure/room/zone list from mocked store.
- CHANGELOG entry referencing navigation live data wiring.

## Acceptance Criteria
- ≤3 source/component files (plus tests) modified; ≤150 diff lines.
- Hooks fallback to fixture data only when store reports `status: 'error'` and no transport configured.
- Tests (1–3) cover success path (live data) and fallback path (error to fixtures).
- Tests to add/modify: 2 component/unit tests.

## References
- SEC §2 hierarchy
- TDD §4 navigation hooks
- Root AGENTS.md §2 determinism, §5 hierarchy invariants
