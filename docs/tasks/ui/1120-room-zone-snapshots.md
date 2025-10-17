# Room & Zone Snapshots

**ID:** 1120
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** backend, read-model, climate

## Rationale
Room and zone dashboards require climate, cultivation, and compatibility data derived from engine subsystems rather than static fixtures.

## Scope
- In: extend read-model providers to compute room climate snapshots, cultivation method metadata, and zone-level KPIs/tasks.
- In: include compatibility and price-book joins needed for UI selectors.
- Out: no HR/workforce data adjustments (handled separately).
- Out: telemetry publishing (Phase 2).
- Rollback: restore previous placeholder snapshot logic.

## Deliverables
- Updated provider logic for room and zone sections, including compatibility arrays.
- Unit tests covering climate snapshot outputs and compatibility filtering.
- Documentation note in CHANGELOG referencing room/zone hydration.

## Acceptance Criteria
- ≤3 source files (plus tests) modified with ≤150 diff lines.
- Room snapshots expose temperature/humidity/lighting metrics consistent with engine data.
- Zone KPIs include cultivation method IDs, compatibility lists, and pending tasks per deterministic world.
- Tests (1–3) assert expected snapshot fields and compatibility filtering.
- Tests to add/modify: 3 unit tests (climate snapshot, compatibility join, zone task list).

## References
- SEC §6 device power/heat coupling, §7 cultivation methods
- TDD §4 room/zone read-models
- Root AGENTS.md §§4–6 (telemetry, device placement, cultivation)
