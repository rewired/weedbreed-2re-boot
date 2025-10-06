# ADR-0003: Irrigation compatibility source of truth anchored at irrigation methods

> **Metadata**
>
> - **ID:** ADR-0003
> - **Title:** Irrigation compatibility source of truth anchored at irrigation methods
> - **Status:** Accepted
> - **Date:** 2025-10-02
> - **Supersedes:** [ADR-0002](./ADR-0002-cultivation-method-irrigation-link.md)
> - **Summary:** Make irrigation method blueprints the canonical authority for substrate compatibility and remove redundant substrate fields.
> - **Binding:** true
> - **Impacts:** SEC, DD, TDD

## Context

ADR-0002 shifted irrigation compatibility metadata from cultivation methods to substrates via a `supportedIrrigationMethodIds` array. In practice this duplicated the compatibility mapping already present on irrigation method blueprints (`compatibility.substrates`) and introduced drift risks whenever substrate files were updated without touching irrigation methods. The duplication also forced chore updates across every substrate blueprint when a new irrigation method was introduced or renamed. We need a single authoritative place to express which substrates an irrigation method can service.

## Decision

- Remove `supportedIrrigationMethodIds` from substrate blueprints entirely.
- Treat irrigation method blueprints as the canonical source of irrigation/substrate compatibility by continuing to require `compatibility.substrates`.
- Require `compatibility.substrates` entries to reference the canonical substrate slug (or id) exported by the substrate blueprints; validation fails fast when a slug drifts.
- Update SEC, DD, and TDD guidance so cultivation methods infer irrigation support by cross-referencing the substrate slug against irrigation methods that list it, avoiding redundant arrays on substrate definitions.
- Mark ADR-0002 as superseded by this decision to preserve historical context.

## Consequences

- Substrate blueprints no longer need updates when irrigation methods change; compatibility management happens in one place.
- Validation logic must ensure that any cultivation method or zone pairing between substrates and irrigation methods checks the irrigation blueprint compatibility list.
- Tooling that previously read `supportedIrrigationMethodIds` from substrates must migrate to query irrigation methods instead.
