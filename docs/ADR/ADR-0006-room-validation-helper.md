# ADR-0006: Room validation helper extraction

> **Metadata**
>
> - **ID:** ADR-0006
> - **Title:** Room validation helper extraction
> - **Status:** Accepted
> - **Date:** 2025-10-02
> - **Supersedes:** _None_
> - **Summary:** Refactor room checks into a dedicated helper to clarify validation responsibilities and reuse boundaries.
> - **Binding:** false
> - **Impacts:** DD

## Context

`validateCompanyWorld` guards the SEC hierarchy and invariants before the tick
pipeline processes a scenario. The routine accumulated nested validation logic
for rooms, zones, plants, and devices in a single loop, making the structure
harder to navigate, hindering reuse in future validation entry points, and
obscuring the distinct invariants that apply at the room boundary.

## Decision

- Extract the room-specific checks (room geometry, growroom zone restrictions,
  nested zone/plant/device validation) into a dedicated `validateRoom` helper
  colocated with `validateDevice` inside
  `packages/engine/src/backend/src/domain/validation.ts`.
- Delegate each room iteration inside `validateCompanyWorld` to the new helper
  while reusing the pre-existing path computation so issue reporting remains
  stable for integrators and tooling that rely on those JSON-pointer style
  paths.

## Consequences

- The validation module now exposes focused helpers for the major hierarchy
  levels, clarifying responsibility boundaries and simplifying upcoming work to
  reuse room checks during partial world updates.
- Future changes to room-specific invariants land in a single function, making
  audits against SEC §2 easier and reducing the chance of regressions during
  refactors.
- `validateCompanyWorld` is shorter and highlights the structure-level
  invariants, improving readability during reviews and incident response.
