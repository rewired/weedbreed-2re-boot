# String Format Safety (Cluster: string-format-safety)

## Symptom
- `@typescript-eslint/restrict-template-expressions` and `no-base-to-string` errors when interpolating numbers or objects into strings.
- `no-useless-escape` on regular expressions/constants.

```ts
logger.info(`Setpoint ${setpoint}`); // number -> string
```

## Root-Cause
Formatting logic trusts implicit `.toString()` which is banned under SEC determinism (locale drift). Lack of format helpers also hides units (°C, m³/h).

## Canonical Fix
- Use explicit formatters: `formatTemperatureC(setpoint)` or `String(value)` before interpolation.
- Append unit labels via helper functions, not inline string concatenation.
- For regex constants, prefer template literals or raw strings without redundant escapes.

```ts
import { formatTemperatureC } from '@/backend/src/format/units.js';
logger.info(`Setpoint ${formatTemperatureC(setpoint)}`);
```

## Edge-Cases
- When serialising JSON, always pass raw objects to `JSON.stringify` instead of manual string building.
- Ensure locale-sensitive formatting remains deterministic (use fixed decimal rounding).

## Regression-Tests
- Add unit tests for new format helpers verifying string output and units.
- Update telemetry snapshot tests to cover explicit formatting.
