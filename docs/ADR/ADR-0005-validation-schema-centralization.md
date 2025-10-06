# ADR-0005: Validation schema centralization

> **Metadata**
>
> - **ID:** ADR-0005
> - **Title:** Validation schema centralization
> - **Status:** Accepted
> - **Date:** 2025-10-02
> - **Supersedes:** _None_
> - **Summary:** Move world validation schemas into the engine package so domain types and schema enforcement share a single source.
> - **Binding:** true
> - **Impacts:** DD, TDD

## Context

Validation schemas that gate blueprint loading currently live in `packages/facade/src/schemas/world.ts`, while the corresponding TypeScript domain types live in `packages/engine/src/backend/src/domain/entities.ts`. This split violates the SEC §3 validation mandate that calls for a single authoritative contract governing economic and blueprint inputs, increasing the risk of divergence between runtime validation and the engine's understanding of the world model.

## Decision

- Move the world validation schemas from the façade package into the engine package alongside `packages/engine/src/backend/src/domain/entities.ts` so the engine owns both the types and the validation contract.
- Add the `zod` dependency to the engine package to support colocated schema validation and re-export the world schemas for downstream consumers that previously relied on the façade copy.
- Remove the duplicated façade schema module and update façade imports to consume the engine-owned exports instead.

## Consequences

- Establishing the engine as the single source of truth for domain schemas eliminates contract drift and strengthens package boundaries between validation and presentation layers.
- Documentation and tooling can point to the engine package for canonical schemas, simplifying audits and future updates.
- Downstream packages must update import paths to the new engine exports, and any façade-specific overrides need to be reconciled during the migration.
