# ADR-0014: Workforce Identity Pseudodata Guarantees

- **Status:** Accepted
- **Date:** 2025-10-06
- **Authors:** Simulation Engine Working Group

## Context

The workforce hiring flow requires human-readable employee identities for UI diagnostics and hiring pipelines. We want to provide plausible names for immersion but must avoid shipping or storing real personally identifiable information. The reboot codebase previously had no canonical mechanism to source deterministic pseudodata identities; prototypes sprinkled ad-hoc `Math.random()` calls or hard-coded placeholder strings, breaking SEC §1 determinism and providing no documentation of the privacy stance.

SEC §10 also mandates that any stochastic employee attributes (names, pronouns, traits) derive from the deterministic RNG interface. Without a documented approach, contributors risk mixing real datasets, leaking unstable seeds, or calling remote APIs without clear fallbacks or privacy expectations.

## Decision

- Introduce a dedicated workforce identity source that first queries `randomuser.me` using an explicit seed and a strict 500 ms timeout. The remote response is mapped onto the engine's gender triad (`m|f|d`) and combined with deterministically sampled traits.
- When the remote API fails or times out the engine deterministically falls back to curated pseudodata lists under `/data/personnel/**`, selecting gender, first and last names, and traits via `createRng(rngSeedUuid, "employee:<rngSeedUuid>")`.
- Document in code comments and this ADR that only pseudodata is stored or emitted, and that the RNG stream naming isolates employee identity draws from other simulation randomness.

## Consequences

### Positive

- Workforce identities remain deterministic and reproducible across online/offline environments, satisfying SEC §1 determinism guarantees.
- The pseudodata fallback ensures we never persist real-world PII while keeping immersion for testers and UI reviewers.
- Clear documentation enables security reviews to verify that the engine only consumes third-party identity data transiently and never stores it without pseudonymisation.

### Negative

- Reliance on `randomuser.me` introduces a soft dependency on an external service; contributors must ensure CI and offline environments respect the 500 ms timeout and handle failures gracefully.
- Maintaining pseudodata lists (names, traits) becomes part of release hygiene to avoid repetition or cultural bias.

### Follow-up

- Extend the identity source once SEC clarifies additional demographic attributes (pronouns, locale, avatar URLs) while keeping pseudodata guarantees intact.
- Consider caching layers or seed registries if future workloads generate large batches of identities in disconnected environments.
