# Inline Rename & Movement Flows

**ID:** 0108
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, flows, movement

## Rationale
Add inline rename and movement flows mandated by the proposal so structures, rooms, zones, and devices can be managed without violating SEC placement rules.
Movement tooling must enforce same-structure constraints and explain eligibility failures while keeping telemetry read-only.

## Scope
- In:
  - Inline rename affordances for structure, room, and zone headers with validation (emptiness, length, characters) and `structure.rename`/`room.rename`/`zone.rename` intents.
  - Zone move flow restricted to targets within the same structure, honoring capacity, room purpose, and placement scope rules with explicit error messaging.
  - Device move/remove/replace flows within the same structure, showing only valid targets and reasons when moves are blocked.
  - Hooks for `device.enable/disable`, `device.setCap`, and category-level device controls from control cards.
- Out:
  - Cross-structure moves (forbidden) or rename of plants/devices (not allowed).
  - Non-UI backend enforcement (assumed already present).

## Deliverables
- Implement inline edit components under `packages/ui/src/components/common` (or module-specific directories) hooking into intents.
- Build movement dialog/side panels for zones/devices under `packages/ui/src/components/flows`.
- Extend read-model selectors to provide placement eligibility metadata and failure reasons.
- Add tests covering rename validation, allowed/blocked movement cases, and error messaging.
- Update `docs/CHANGELOG.md` summarizing movement tooling.

## Acceptance Criteria
- Structure, room, and zone headers support inline rename with validation feedback and dispatch the correct rename intents.
- Zone move dialog limits targets to rooms within the same structure, enforces capacity/purpose/placement scope, and surfaces explicit error reasons on failure.
- Device move/remove/replace flows restrict to same-structure targets, display eligibility details, and wire to intents (`device.move`, `device.remove`, `device.replace`, `device.enable/disable`, `device.setCap`).
- Movement tooling integrates with control cards so category-level device controls reflect updated caps/toggles.
- All flows preserve telemetry as read-only and never present cross-structure move options.

## References
- docs/proposals/20251013-ui-plan.md §3, §6, §11.8
- AGENTS.md (root) — placement scope + telemetry guardrails
