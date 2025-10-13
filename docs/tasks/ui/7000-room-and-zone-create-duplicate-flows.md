# Room & Zone Create/Duplicate Flows

**ID:** 7000
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, flows, forms

## Rationale
Implement the room creation, zone creation wizard, sowing flow, and duplicate dialogs defined in the proposal so operators can expand facilities while respecting SEC constraints.
These flows enforce compatibility checks, cost previews, and zero-plant duplicates mandated by the UI spec.

## Scope
- In:
  - Room create dialog capturing name, area (m²), optional height (m), and purpose with validation against structure free area/volume; intent wiring to `room.create`.
  - Zone create wizard with steps for area input, cultivation/irrigation selection (ok/warn/block badges), derived max plants and acquisition cost preview, culminating in `zone.create` intent.
  - Sowing flow for empty zones selecting strain and count ≤ max plants with compatibility checks and cost preview, dispatching `plants.sow`.
  - Room/Zone duplicate dialogs that ensure no plants are cloned, inventory treated as new purchases, capacity/eligibility validation, schedule/CM-irrigation checks, #copies selection, and preview of devices needed + neutral Opex/h.
  - Area update flows for rooms/zones (`room.setArea`, `zone.setArea`) updating derived capacities.
- Out:
  - Device procurement automation beyond previewing counts (capacity advisor handles).
  - Persisting scenario templates (focus on runtime intents).

## Deliverables
- Create modal/dialog components under `packages/ui/src/components/forms` (or similar) and integrate them with structure/room/zone modules.
- Use read-model/price book data to compute compatibility statuses, max plants, and acquisition cost previews.
- Add validators/utilities for ok/warn/block logic and area/capacity checks under `packages/ui/src/lib`.
- Write tests covering validation states, cost derivations, and zero-plant duplicate enforcement.
- Record the flows in `docs/CHANGELOG.md`.

## Acceptance Criteria
- Room create dialog enforces structure free area/volume constraints, optional height input, and dispatches `room.create` with validated payloads.
- Zone wizard blocks incompatible CM/Irrigation combinations, shows ok/warn statuses, calculates max plants and acquisition costs, and dispatches `zone.create` when valid.
- Sowing flow only enables when zone is empty, enforces count ≤ max plants with compatibility badges, and dispatches `plants.sow`.
- Duplicate room/zone dialogs prevent plant cloning, treat inventory as new purchases, validate capacity/eligibility/schedule/CM-Irrigation, allow #copies selection, and preview device requirements + neutral Opex/h.
- Area update actions recalculate capacities/max plants and trigger `room.setArea`/`zone.setArea` intents with validation errors explained.

## References
- docs/proposals/20251013-ui-plan.md §3, §4, §11.7
- AGENTS.md (root) — zone cultivation + economy rules
