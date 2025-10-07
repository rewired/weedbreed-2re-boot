# ADR-0020: Zone Height Baseline & Cultivation Presets

> **Metadata**
>
> - **ID:** ADR-0020
> - **Title:** Zone Height Baseline & Cultivation Presets
> - **Status:** Accepted
> - **Date:** 2025-10-07
> - **Supersedes:** _None_
> - **Summary:** Fix the default zone height to the room default (3 m) when not specified and lock the launch cultivation presets to the existing soil and training methods with canonical container/substrate bundles.
> - **Binding:** true
> - **Impacts:** SEC, DD, TDD, VISION

## Context

SEC §1 defines `ROOM_DEFAULT_HEIGHT_M = 3` m, but zone formulas (air volume, canopy headroom, device coverage) lacked guidance on whether to assume a standard height or depend entirely on room blueprints. SEC §14 also left cultivation method presets undecided, calling out SoG/ScRoG/DWC defaults. Without clarity, physics calculations (e.g., heat load volume) and onboarding flows could diverge.

## Decision

- **Zone height:** When a room blueprint omits `height_m` and a zone does not specify `canopyHeight_m`, simulations SHALL assume a zone interior height of **3 m** (matching `ROOM_DEFAULT_HEIGHT_M`). Device coverage calculations use this as the baseline air volume. If a room overrides height, zones inherit that value; zones may further constrain canopy height via cultivation method `capacityHints.canopyHeight_m`.
- **Cultivation presets:** The launch-ready preset list is:
  1. `basic-soil-pot` — defaults to `pot-10l` with `soil-single-cycle` substrate.
  2. `sea-of-green` — defaults to `pot-11l` with `coco-coir` substrate.
  3. `screen-of-green` — defaults to `pot-25l` with `soil-multi-cycle` substrate.

  These presets SHALL remain available in `/data/blueprints/cultivation-method/` and surface as selectable defaults in tooling and fixtures. Hydroponic (DWC) presets remain deferred until dedicated containers/substrates ship; introducing them requires a new ADR documenting the bundle.

## Consequences

- **Pros:** Locks physics calculations to a deterministic height baseline, enabling device sizing formulas and stress models to share assumptions. Provides a clear starter set of cultivation presets for UI flows and tests, aligned with existing blueprint data.
- **Cons:** Growers seeking taller canopy baselines must rely on room-specific overrides until expanded presets arrive.
- **Follow-up:** Update documentation (SEC §7, DD cultivation sections, VISION onboarding flows) to reference the preset mapping; ensure validation enforces availability of the listed container/substrate slugs.

## Alternatives Considered

- **Zone-specific default height different from room default:** Rejected; would desynchronise room physics from zone formulas and complicate blueprint authoring.
- **Include DWC at launch:** Rejected due to missing container/substrate assets and lack of hydroponic environment validation.

## Links

- SEC §7 Zone Requirements & Environment
- AGENTS §3 Canonical Constants
- TDD §3 Data Validation & Fixtures
- VISION_SCOPE §1 Vision (Onboarding presets)
