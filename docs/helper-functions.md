# Helper Function Registry

This catalogue lists the shared helper modules that replace previously duplicated
implementations. Use these utilities instead of introducing local variants to
keep behaviour consistent across the engine and tests.

## Backend utilities

- `packages/engine/src/backend/src/util/math.ts`
  - `clamp(value, min, max)` — bounds values while handling infinities safely.
  - `clamp01(value)` — clamps to the `[0,1]` interval.
- `packages/engine/src/backend/src/util/validation.ts`
  - `assertPositiveFinite(value, name)` — asserts a value is finite and `> 0`.
  - `assertNonNegativeFinite(value, name)` — asserts a value is finite and `>= 0`.
  - `ensureFraction01(value, fallback, name)` — validates optional fractions in `[0,1]`.
- `packages/engine/src/backend/src/util/environment.ts`
  - `resolveAirflow(value)` — normalises airflow inputs to a non-negative flow.
  - `resolveAirMassKg(value)` — normalises air mass values to a non-negative mass.
- `packages/engine/src/backend/src/engine/resolveTickHours.ts`
  - `resolveTickHoursValue(value)` — resolves tick durations with canonical fallbacks.

## Test utilities

- `packages/engine/tests/testUtils/deviceHelpers.ts`
  - `deviceQuality(qualityPolicy, seed, id, blueprint)` — samples deterministic
    device quality via `createDeviceInstance`.

> ⚠️ If you need a new helper, add it to one of these modules (or extend this
> list) rather than re-implementing ad-hoc versions.
