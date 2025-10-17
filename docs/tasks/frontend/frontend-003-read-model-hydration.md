# Hydrate Facade Read Models with Live Metrics

**ID:** FRONT-003
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** backend, read-models, telemetry

## Rationale
Facade read-model providers currently emit zeroed KPIs and empty collections, leaving the UI stuck on placeholders even if data exists. We must compute real structure/room/zone, economy, and HR metrics from the enriched demo world.

## Scope
- In: Update read-model composition modules to derive structure dashboards, room climate snapshots, zone KPIs/tasks, economy totals, HR directories, and catalogs from engine state.
- In: Add schema validators/TypeScript types for any new fields required by SEC/DD.
- Out: Frontend store changes; transport protocol changes beyond read-model HTTP payloads; telemetry streaming.

## Deliverables
- Modified provider modules (e.g. `packages/transport/src/readModels/**`) with tests covering new metrics.
- Updated shared types consumed by the UI (likely in `packages/types` or similar).
- Documentation note summarising new fields and their SEC alignment.

## Acceptance Criteria
- `/api/read-models` returns populated dashboards for structures, rooms, zones, workforce, economy, and catalogs.
- Unit tests/assertions confirm non-empty payloads and deterministic values given the demo seed.
- Breaking changes to schemas are documented and versioned per DD guidance.

## References
- SEC §§1–3, §6, §7.5
- DD §4 (read-model expectations)
- TDD §2 (transport payload contracts)
