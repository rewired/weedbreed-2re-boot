# Read-Model Aggregation Layer

**ID:** 1000
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, data, read-models

## Rationale
Stand up the Structure/Room/Zone, Economy, and HR read models defined in the UI proposal so React modules can render capacity, coverage, and workforce views deterministically.
Centralizing aggregation keeps compatibility maps, price book data, and telemetry joins consistent with SEC expectations before we wire module-level UI.

## Scope
- In:
  - Define typed clients/selectors for `SimulationRM`, `EconomyRM`, `StructureRM`, `RoomRM`, `ZoneRM`, and `HRRM` including capacity, coverage, devices, KPIs, timelines, and task queues.
  - Surface PriceBook/Catalog data (seedlings, containers, substrates, irrigation line; device coverage/throughput) and compatibility maps (CM ↔ Irrigation, Strain ↔ CM/Irrigation) to consuming hooks.
  - Provide deterministic fallback/stub data pathways so UI renders while transport wiring is staged.
  - Establish error/loading states and refresh strategy aligned with existing transport binder conventions.
- Out:
  - Building specific UI presentations (structures/rooms/zones/HR) that consume the layer.
  - Implementing backend endpoints (assume transport already exposes required contracts).

## Deliverables
- Add a dedicated read-model store/module under `packages/ui/src/state` (e.g., `readModels.ts`) with typed selectors and Zustand wiring.
- Extend `packages/ui/src/transport` to fetch and normalize the read-model payloads, including compatibility maps and price book material.
- Provide memoized React hooks (e.g., `useStructureReadModel`, `useHRReadModel`) under `packages/ui/src/pages` or `packages/ui/src/lib` for downstream modules.
- Seed fixture data under `packages/ui/tests` or `packages/ui/src/test-utils` to validate aggregation outputs.
- Update documentation in `docs/CHANGELOG.md` summarizing the read-model layer introduction.

## Acceptance Criteria
- Hooks expose merged Structure/Room/Zone read models that include capacity, coverage, device summaries, KPIs, and timelines matching the proposal fields.
- HR read model supplies directory entries, activity timeline, task queues, and capacity snapshots suitable for the HR page.
- Price book catalog surfaces per-area acquisition costs, device coverage/throughput, and compatibility flags required by create/duplicate flows.
- Compatibility maps provide ok/warn/block determinations for CM ↔ Irrigation and Strain ↔ CM/Irrigation requests that downstream flows can consume.
- All selectors return deterministic stub data when transport is unavailable and handle refresh/errors without breaking the shell.

## References
- docs/proposals/20251013-ui-plan.md §8
- AGENTS.md (root) — determinism and SI-unit guardrails
