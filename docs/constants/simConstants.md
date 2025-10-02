# Canonical Simulation Constants

> Source of truth: [Simulation Engine Contract (SEC) v0.2.1](../SEC.md) §1.2

The Weed Breed simulation engine centralises all canonical constants in
[`src/backend/src/constants/simConstants.ts`](../../packages/engine/src/backend/src/constants/simConstants.ts).
Tooling and runtime code **must** import from this module instead of redefining
values locally. The constants follow SI units and enforce the per-hour economic
normalisation mandated by the SEC.

| Identifier | Value | Unit | Description |
| --- | --- | --- | --- |
| `AREA_QUANTUM_M2` | `0.25` | m² | Minimal calculable floor area for placement, zoning, and area rounding. |
| `ROOM_DEFAULT_HEIGHT_M` | `3` | m | Default room interior height when blueprints omit overrides. |
| `HOURS_PER_TICK` | `1` | h | Duration represented by one simulation tick (one in-game hour). |
| `HOURS_PER_DAY` | `24` | h | Hours per in-game day (calendar invariant). |
| `DAYS_PER_MONTH` | `30` | d | Days per in-game month. |
| `MONTHS_PER_YEAR` | `12` | months | Months per in-game year. |
| `HOURS_PER_MONTH` | `720` | h | Derived: `HOURS_PER_DAY × DAYS_PER_MONTH`. |
| `HOURS_PER_YEAR` | `8 640` | h | Derived: `HOURS_PER_MONTH × MONTHS_PER_YEAR`. |

## Usage guidelines

- Import constants via `@/backend/src/constants/simConstants` or re-exports from
  `@wb/engine`.
- Never redeclare the identifiers above in application code. A dedicated ESLint
  rule (`wb-sim/no-duplicate-sim-constants`) enforces this guardrail.
- Treat `SIM_CONSTANTS` as immutable; attempting to mutate the object will throw
  at runtime.
