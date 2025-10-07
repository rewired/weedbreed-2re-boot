# ADR-0007: Deterministic RNG utility

> **Metadata**
>
> - **ID:** ADR-0007
> - **Title:** Deterministic RNG utility
> - **Status:** Accepted
> - **Date:** 2025-10-02
> - **Supersedes:** _None_
> - **Summary:** Introduce `createRng(seed, streamId)` as the sole stochastic interface with deterministic coverage tests.
> - **Binding:** true
> - **Impacts:** SEC, DD, TDD

## Context

The Simulation Engine Contract (SEC §5) mandates a deterministic random number
interface (`createRng(seed, streamId)`) so identical seeds and inputs yield the
same simulation outcomes. The engine package lacked a canonical implementation,
forcing downstream modules and tests to hand-roll RNG logic or temporarily rely
on `Math.random`, which violates determinism guarantees and complicates
reproducibility audits.

## Decision

- Add `createRng(seed, streamId)` under
  `packages/engine/src/backend/src/util/rng.ts`, using the `xmur3` mixer to
  expand the combined `{seed, streamId}` tuple into a 32-bit state that seeds a
  `mulberry32` generator.
- Enforce non-empty seed and stream identifiers so accidental blank inputs
  surface immediately rather than silently sharing RNG sequences.
- Re-export the utility from `packages/engine/src/index.ts` and rely on the
  existing `@/backend` path alias so future engine modules and tests resolve the
  generator through the public surface instead of duplicating hashing logic.
- Provide Vitest coverage to guarantee reproducible sequences for matching
  inputs and divergence between distinct stream identifiers.

## Consequences

- All stochastic engine code can adopt the shared utility, ensuring
  reproducibility and simplifying audits against SEC determinism requirements.
- The public export clarifies the preferred RNG entry point for downstream
  packages, discouraging ad-hoc implementations or direct `Math.random` usage.
- Tests now exercise the determinism contract, reducing the risk of accidental
  regressions when evolving the hashing or generator strategy in the future.
