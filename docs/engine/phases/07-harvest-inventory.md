# Phase 07 — Harvest & Inventory

The `applyHarvestAndInventory` phase executes immediately after plant physiology and
before any economic read-model aggregation. Its responsibility is to move harvest-ready
plants into their structure's storage inventory while keeping the simulation deterministic
and free from floating produce.

## Inputs
- Current world snapshot with plants marked `readyForHarvest`.
- Storage room metadata (`class`, `tags`, and `inventory` state).
- Engine run context for telemetry and diagnostics sinks.

## Behaviour
1. Traverse all structures and zones to locate plants flagged `readyForHarvest`.
2. Resolve a single storage target per structure:
   - Prefer rooms with `class === "room.storage"`.
   - Otherwise pick a room whose `tags` include `"storage"`.
   - If no unique candidate is found, abort harvesting for that structure, emit diagnostics,
     and fire `telemetry.storage.missing_or_ambiguous.v1` with the candidate room ids.
3. On success, assemble a `HarvestLot` using plant biomass, moisture, and quality metrics,
   validate it, append it to the target room's `inventory.lots`, and mark the plant as
   harvested for the current tick.
4. Emit `telemetry.harvest.created.v1` for each created lot and record trace diagnostics
   via the engine context.

## Invariants
- Harvesting never proceeds without an unambiguous storage room.
- Plants harvested in a tick are tagged `status: "harvested"`, `readyForHarvest: false`, and
  `harvestedAt_tick = world.tick`, preventing double harvest within the same tick.
- Storage room inventories always contain validated `HarvestLot` entries persisted with the
  world snapshot; derived read-model aggregates remain transient.

## Telemetry
- `telemetry.harvest.created.v1` — emitted per harvested lot (structure, room, plant, zone,
  weight, quality, moisture metadata).
- `telemetry.storage.missing_or_ambiguous.v1` — emitted when a structure has zero or
  multiple storage candidates, includes `{ structureId, candidateRoomIds }`.
