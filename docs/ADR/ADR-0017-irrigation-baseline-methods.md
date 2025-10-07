# ADR-0017: Irrigation Baseline Methods (v1 Minimum Set)

> **Metadata**
>
> - **ID:** ADR-0017
> - **Title:** Irrigation Baseline Methods (v1 Minimum Set)
> - **Status:** Accepted
> - **Date:** 2025-10-07
> - **Supersedes:** _None_
> - **Summary:** Lock the v1 simulation baseline to four irrigation methods spanning manual, drip, top-feed, and ebb-flow patterns with deterministic substrate compatibility.
> - **Binding:** true
> - **Impacts:** SEC, DD, TDD, VISION

## Context

SEC §7.5 and AGENTS §5.1 require every zone to choose exactly one irrigation method via its cultivation method substrate selection. The open question in SEC §14 asked for the minimum viable method set needed to cover the launch feature scope without fragmenting blueprint or testing effort. Existing blueprints (`data/blueprints/irrigation/*.json`) already model manual watering, drip, top-feed, and ebb-flow tables, but the contract never committed to which of them are mandatory or how they map to cultivation method defaults, leaving implementation teams uncertain about coverage guarantees and test fixtures.

## Decision

Adopt the following **four canonical irrigation methods** for the v1 baseline:

1. `manual-watering-can` — deterministic hand-watering with measured pour volume, representing the low-tech baseline.
2. `drip-inline-fertigation-basic` — pressure-compensated drip tape with fertigation support for soil/coco substrates.
3. `top-feed-pump-timer` — top-fed recirculating buckets on a fixed duty timer for coco or inert substrates.
4. `ebb-flow-table-small` — tray-based flood-and-drain suitable for shared substrate beds.

These methods SHALL remain present in `/data/blueprints/irrigation/` and in conformance fixtures. Cultivation methods must reference substrate options that are explicitly listed under each method’s `compatibility.substrates`, guaranteeing at least one valid pairing per method. Adding new irrigation methods is permitted, but removing or renaming any of the four canonical entries requires a superseding ADR.

## Consequences

- **Pros:** Establishes deterministic coverage for manual, drip, top-feed, and ebb-flow scenarios, enabling tests and UI flows to rely on known method IDs. Simplifies validation logic because every launch cultivation method can depend on at least one of these contracts.
- **Cons:** Additional irrigation patterns (e.g., aeroponics) stay out of scope until a future ADR extends the baseline.
- **Follow-up:** Update cultivation method defaults and documentation to call out these canonical pairings (captured alongside ADR-0020 for canopy assumptions).

## Alternatives Considered

- **Only manual + drip:** Rejected; would fail to cover hydroponic trays that VISION_SCOPE §1 calls out for advanced growers.
- **Defer to data-only policy:** Rejected; without a binding ADR the minimum coverage could regress, breaking SEC §7.5 guarantees.

## Links

- SEC §7.5 Zone Requirements
- AGENTS §5.1 Cultivation Method Requirements
- TDD §3 Data Validation & Fixtures
- VISION_SCOPE §1 Vision (Irrigation experience pillar)
