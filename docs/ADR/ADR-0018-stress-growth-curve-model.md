# ADR-0018: Stress→Growth Curve Model

> **Metadata**
>
> - **ID:** ADR-0018
> - **Title:** Stress→Growth Curve Model
> - **Status:** Accepted
> - **Date:** 2025-10-07
> - **Supersedes:** _None_
> - **Summary:** Formalise the plant stress response as a piecewise quadratic tolerance ramp that maps environmental deltas to growth multipliers.
> - **Binding:** true
> - **Impacts:** SEC, DD, TDD, VISION

## Context

SEC §8 mandates that growth, stress, and quality derive from environmental tolerances provided by strain blueprints. Prior task 0014 implemented Magnus-based VPD calculations, dew point clamps, and quadratic tolerance evaluation in code/tests, but SEC §14 still listed the stress→growth curve shape as unresolved. Without a binding ADR, downstream teams lacked assurance that the quadratic ramp was the canonical form and that tests must guard it.

## Decision

Adopt a **piecewise quadratic tolerance ramp** for every stress dimension (temperature, VPD/humidity, PPFD):

- Within the strain’s ideal band, growth multiplier = 1 and stress contribution = 0.
- Inside the warning band (between ideal and hard min/max), stress increases quadratically with the normalised distance from ideal, producing growth multipliers in (0, 1).
- Outside the hard limits, growth multiplier clamps to 0 and stress contribution saturates at 1.

The combined growth multiplier is the product of each dimension’s multiplier, while stress is the max of the per-dimension contributions. TDD fixtures (`stressCurves.spec.ts`, `plantStress.integration.test.ts`) MUST validate these rules. Any alternative curve shape or weighting scheme requires a superseding ADR.

## Consequences

- **Pros:** Deterministic, differentiable curve with zero slope at ideal boundaries, matching horticulture expectations and existing tests.
- **Cons:** Does not yet incorporate strain-specific asymmetry (e.g., slower penalties on cool side); future ADRs can introduce parameterised exponents if required.
- **Follow-up:** Ensure strain blueprints document warning/limit bands explicitly so designers understand the quadratic mapping.

## Alternatives Considered

- **Linear ramps:** Rejected for producing discontinuities in growth derivatives at band edges and underrepresenting stress accumulation.
- **Sigmoid/logistic curves:** Rejected for added parameter complexity without evidence of gameplay benefit.

## Links

- SEC §8 Plant Model Lifecycle & Growth
- TDD §3 Physiological VPD/Stress Coverage
- VISION_SCOPE §1 Vision (Stress tuning pillar)
