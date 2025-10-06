# ADR-0002: Cultivation method irrigation compatibility via substrates

> ⚠️ **Superseded by [ADR-0003](./ADR-0003-irrigation-compatibility-source-of-truth.md).**

> **Metadata**
>
> - **ID:** ADR-0002
> - **Title:** Cultivation method irrigation compatibility via substrates
> - **Status:** Superseded
> - **Date:** 2025-10-02
> - **Supersedes:** _None_
> - **Summary:** Proposed moving irrigation compatibility data from cultivation methods into substrate definitions.
> - **Binding:** false
> - **Impacts:** SEC, DD, TDD

## Context

Simulation Engine Contract (SEC) §7.5 previously required cultivation methods to list compatible irrigation methods directly. ISSUE-0002 remediation work revealed that blueprints also need richer substrate metadata. To reduce duplication and keep irrigation compatibility tied to physical media behavior, we want substrates to declare which irrigation methods they support. Cultivation methods should therefore inherit irrigation compatibility through the substrates they offer rather than duplicating lists.

## Decision

- Rename the legacy `areaPerPlant` field to `areaPerPlant_m2` in cultivation method blueprints to satisfy SEC nomenclature.
- Replace the generic `compatibleContainerTypes` and `compatibleSubstrateTypes` arrays with explicit `containers` and `substrates` lists that reference concrete blueprint slugs.
- Extend substrate blueprints with `supportedIrrigationMethodIds`. Cultivation methods no longer declare `irrigationMethodIds`; compatibility is resolved by aggregating the irrigation methods supported by the chosen substrate.
- Update SEC, DD, and agent guidance to reflect the substrate-driven irrigation link.

## Consequences

- Consumers that previously read `compatible*` arrays or `irrigationMethodIds` must migrate to the new field names and derive irrigation compatibility from substrate metadata.
- Substrate blueprints now serve as the single source of truth for irrigation support, preventing drift between method and substrate definitions.
- Further work is required to enrich cultivation method `containers`/`substrates` entries with economic data (CapEx, unit price, density factors) to fully meet SEC §7.5, tracked separately.
