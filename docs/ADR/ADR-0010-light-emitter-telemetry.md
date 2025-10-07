# ADR-0010: Zone lighting telemetry and light emitter stub

> **Metadata**
>
> - **ID:** ADR-0010
> - **Title:** Zone lighting telemetry and light emitter stub
> - **Status:** Accepted
> - **Date:** 2025-10-03
> - **Supersedes:** _None_
> - **Summary:** Extend zone state, schemas, and stubs to publish PPFD/DLI telemetry with deterministic coverage tests.
> - **Binding:** true
> - **Impacts:** SEC, DD, TDD

## Context

The Simulation Engine Contract (SEC v0.2.1) specifies that lighting devices
contribute photosynthetic photon flux density (PPFD) and daily light integral
(DLI) metrics at the zone scope, yet the engine lacked concrete plumbing for
those aggregates. Zones did not persist PPFD or per-tick DLI increments, the
light emitter interface had no implementation, and validation could not guard
lighting telemetry. Without these hooks, upcoming lighting pipeline stages and
photoperiod analytics could not consume deterministic tick outputs or enforce
non-negative values mandated by the contract.

## Decision

- Extend the `Zone` domain entity, schemas, and validation routines with
  `ppfd_umol_m2s` and `dli_mol_m2d_inc` so lighting telemetry becomes part of the
  canonical world snapshot and remains non-negative/finiteness guarded.
- Implement `createLightEmitterStub` following the plateau-field behaviour from
  the SEC: PPFD scales linearly with dimming, DLI derives from tick seconds, and
  optional `power_W` inputs report watthour consumption for energy accounting.
- Add deterministic Vitest coverage mirroring the consolidated stub reference
  vectors (dimming clamps, DLI increments, edge-case validation) to preserve the
  contract as future lighting features land.

## Consequences

- Zone fixtures, bootstrap harnesses, and validators now initialise lighting
  telemetry fields, ensuring downstream systems observe zeroed values until
  lighting devices contribute increments.
- Device pipelines can rely on the stub to provide deterministic PPFD/DLI
  outputs during early integration while maintaining SEC-aligned error handling
  for invalid inputs.
- Documentation (CHANGELOG and this ADR) now records the contract change, giving
  contributors a clear reference for lighting telemetry expectations and testing
  requirements.
