# Magic Numbers (Cluster: magic-numbers)

## Symptom
- ESLint `@typescript-eslint/no-magic-numbers` warnings on inline literals, e.g.
  ```ts
  const defaultShiftMinutes = 480; // flagged
  ```

## Root-Cause
Inline numerics encode SEC-critical constants (shift lengths, trait weights, blueprint factors) directly inside logic instead of referencing the canonical constants module. This hides policy, duplicates values, and breaks DD invariants when numbers drift.

## Canonical Fix
- Introduce or reuse exported constants inside `packages/engine/src/backend/src/constants/simConstants.ts` (and mirror docs).
- Provide descriptive names (e.g. `WORKER_SHIFT_MINUTES = HOURS_PER_DAY * 60`).
- Replace call sites with the constant import; update tests/read models accordingly.
- For arrays/maps of weights, move structure into typed config objects keyed by enum/UUID.

```ts
// simConstants.ts
export const WORKER_SHIFT_MINUTES = HOURS_PER_DAY * 60;

// workforce module
import { WORKER_SHIFT_MINUTES } from '@/backend/src/constants/simConstants.js';
const defaultShiftMinutes = WORKER_SHIFT_MINUTES;
```

## Edge-Cases
- Constants that differ per blueprint/device: place in blueprint JSON and surface via typed loader instead of code constant.
- Random seeds / tolerance thresholds: confirm with SEC §1 determinism (use `EPS_REL`/`EPS_ABS`).

## Regression-Tests
- Extend unit tests to assert constants propagate (e.g. payroll calculations use `WORKER_SHIFT_MINUTES`).
- Add snapshot/assertions to ensure `simConstants` export documented values (no drift).
