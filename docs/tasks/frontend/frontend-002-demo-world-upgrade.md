# Build Deterministic Multi-Structure Demo World

**ID:** FRONT-002
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** backend, read-models, data-prep

## Rationale
Current dev transports spawn an almost empty `SimulationWorld`, so even with live wiring the UI would surface blanks. We need a richer deterministic seed to exercise structures, rooms, zones, devices, and workforce flows.

## Scope
- In: Replace or extend the demo world loader to assemble multiple structures with populated rooms/zones, device placements, and workforce roster using existing blueprints/fixtures.
- In: Ensure economics (tariffs, price maps) and cultivation methods are populated per SEC requirements.
- Out: Changes to real production data importers; modifying UI fetch logic; altering blueprint JSON schemas.

## Deliverables
- Updated backend/demo loader code (e.g. `packages/transport/src/demo/**`) producing deterministic, SEC-compliant entities.
- Unit snapshot or golden test covering the new world shape.
- Documentation note in `docs/tasks/frontend/FRONT-002` summarising the scenario contents.

## Acceptance Criteria
- Demo world includes at least two structures, multiple growrooms with zones, and a staffed workforce roster.
- All entities validate against SEC invariants (room purposes, cultivation methods, device placement scopes).
- Running the transport server emits non-empty read-model payloads reflecting the new world.

## References
- SEC §§1–2, §5, §7.5
- DD §3 (scenario expectations)
- Root `AGENTS.md` invariants #2–#5
