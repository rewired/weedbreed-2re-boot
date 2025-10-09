
# HOTFIX-08 — Concrete Refactor: `packages/engine/tests/unit/services/workforce/raises.test.ts`

**Goal:** Convert the failing `raises.test.ts` to a type-safe pattern without `!`, `any`, or unsafe member access/calls. Use the guard helpers from HOTFIX‑04 and numeric normalization from HOTFIX‑05.

---

## 1) Prereqs

- Ensure HOTFIX‑04 helpers exist at:  
  `packages/engine/tests/util/expectors.ts` (functions: `expectDefined`, `asObject`, `hasKey`, `toNumber`, `toBigInt`, `unwrap`, `unwrapErr`).

- Ensure TypeScript/Vitest resolution is fixed per HOTFIX‑01/02/03 so imports resolve to **typed sources**.

---

## 2) Replace risk patterns (Find → Fix)

| Pattern in file | Replace with |
|---|---|
| `result!.data` / `result!.error` | `unwrap(result)` / `unwrapErr(result)` |
| `candidate!.id` | ```ts
const obj = asObject(candidate); expect(hasKey(obj, 'id')).toBe(true); const id = obj.id as string;``` |
| `x + y` where `x`/`y` are `unknown/any` | ```ts
const a = toNumber(x); const b = toNumber(y); expect(a + b) ...``` |
| `someUnion as any` | Guard (`asObject`, `hasKey`) + narrow minimal cast for the asserted property |
| Non‑null assertion `!` | `expectDefined(value)` and assign to local const |
| BigInt/number mix | Normalize once: **either** `toNumber()` **or** `toBigInt()` consistently in that test block |

---

## 3) Suggested header for `raises.test.ts`

```ts
// packages/engine/tests/unit/services/workforce/raises.test.ts

import { describe, it, expect } from 'vitest';

// Use typed entrypoints (ensure alias points to src per HOTFIX‑01)
import { createCompany, applyRaisePolicy } from '@/backend/services/workforce/raises';
import type { RaiseDecision, Employee } from '@/backend/domain/workforce/types';

// Guard/expect helpers (HOTFIX‑04)
import {
  expectDefined,
  asObject,
  hasKey,
  toNumber,
  toBigInt,
  unwrap,
  unwrapErr
} from '../../util/expectors';
```

> Falls eure tatsächlichen Pfade leicht abweichen (z. B. `@/backend`), die Imports entsprechend anpassen. Wichtig: **auf `src` zeigen, nicht auf `dist`.**

---

## 4) Example: Safe access to candidate/market fields

**Before (typische Fehler):**
```ts
const decision = makeRaiseDecision(company, pool)!;
expect(decision.candidate!.id).toBeDefined();
expect(decision.market!.rateIncreaseFactor + 0.02).toBeGreaterThan(0);
```

**After (safe & explicit):**
```ts
const decision = expectDefined(makeRaiseDecision(company, pool));

const candObj = asObject(decision.candidate);
expect(hasKey(candObj, 'id')).toBe(true);
const candId = candObj.id as string;
expect(candId).toMatch(/[a-z0-9-]{10,}/i);

const marketObj = asObject(decision.market);
expect(hasKey(marketObj, 'rateIncreaseFactor')).toBe(true);
const rif = toNumber(marketObj.rateIncreaseFactor);
expect(rif + 0.02).toBeGreaterThan(0);
```

---

## 5) Example: Unwrapping result objects

**Before:**
```ts
const res = applyRaisePolicy(company)!;
expect(res.data!.employee!.moraleDelta01).toBeGreaterThan(0);
```

**After:**
```ts
const res = expectDefined(applyRaisePolicy(company));
const data = unwrap(res as { success: true; data: unknown }); // or import actual Result type

const dataObj = asObject(data);
expect(hasKey(dataObj, 'employee')).toBe(true);
const empObj = asObject(dataObj.employee);
expect(empObj).not.toBeNull();

if (empObj) {
  expect(hasKey(empObj, 'moraleDelta01')).toBe(true);
  const moraleDelta = toNumber(empObj.moraleDelta01);
  expect(moraleDelta).toBeGreaterThan(0);
}
```

> Hinweis: Wenn ihr einen **echten** `Result<T>` Typ exportiert (empfohlen), importiert ihn und ersetzt das generische `unknown` oben durch korrekte Typen – dann entfällt der Cast im `unwrap(...)`.

---

## 6) Example: Arithmetic with strict typing

**Before (triggered `restrict-plus-operands` + `no-unsafe-argument`):**
```ts
const base = res.employee!.morale01;
const delta = res.employee!.moraleDelta01;
expect(base + delta).toBeLessThanOrEqual(1);
```

**After:**
```ts
const resObj = asObject(res);
const emp = asObject(resObj?.employee);
expect(emp).not.toBeNull();

if (emp) {
  expect(hasKey(emp, 'morale01')).toBe(true);
  expect(hasKey(emp, 'moraleDelta01')).toBe(true);
  const base = toNumber(emp.morale01);
  const delta = toNumber(emp.moraleDelta01);
  expect(base + delta).toBeLessThanOrEqual(1);
}
```

---

## 7) Example: Number vs BigInt normalization

If your code returns `number | bigint` (e.g., cost/ticks), pick **one** per test:

```ts
const minutes = toNumber(summary.baseMinutes);  // use consistently as number here
const ot = toNumber(summary.otMinutes);
expect(minutes + ot).toBeGreaterThan(0);

// OR

const minutes = toBigInt(summary.baseMinutes); // bigints throughout
const ot = toBigInt(summary.otMinutes);
expect(minutes + ot >= 0n).toBe(true);
```

---

## 8) Minimal, type-safe test case template

Use this as a blueprint for each failing block in `raises.test.ts`:

```ts
describe('workforce raises', () => {
  it('selects a candidate and applies market raise factor', () => {
    const company = createCompany({ seed: 'test-seed' });

    const decision = expectDefined(applyRaisePolicy(company)); // or makeRaiseDecision

    const d = asObject(decision);
    expect(d).not.toBeNull();

    if (!d) return; // TS narrow

    // candidate
    expect(hasKey(d, 'candidate')).toBe(true);
    const candidate = asObject(d.candidate);
    expect(candidate).not.toBeNull();
    if (!candidate) return;

    expect(hasKey(candidate, 'id')).toBe(true);
    const candidateId = candidate.id as string;
    expect(candidateId).toBeTruthy();

    // market
    expect(hasKey(d, 'market')).toBe(true);
    const market = asObject(d.market);
    expect(market).not.toBeNull();
    if (!market) return;

    expect(hasKey(market, 'rateIncreaseFactor')).toBe(true);
    const rif = toNumber(market.rateIncreaseFactor);
    expect(rif).toBeGreaterThan(0);

    // employee & morale
    expect(hasKey(d, 'employee')).toBe(true);
    const employee = asObject(d.employee);
    expect(employee).not.toBeNull();
    if (!employee) return;

    expect(hasKey(employee, 'morale01')).toBe(true);
    expect(hasKey(employee, 'moraleDelta01')).toBe(true);
    const morale = toNumber(employee.morale01);
    const delta = toNumber(employee.moraleDelta01);

    expect(morale + delta).toBeLessThanOrEqual(1);
  });
});
```

---

## 9) Acceptance Criteria (file-specific)

- `raises.test.ts` contains **no** `!` non‑null assertions.
- No occurrences of `@typescript-eslint/no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-call`, or `restrict-plus-operands` remain in this file.
- Test continues to validate the same business behavior as before (no semantic weakening).
- `pnpm -r test` passes for this suite when HOTFIX‑01..07 are applied.

---

## 10) Notes

- If domain types (`RaiseDecision`, `Employee`) are available, import and use them directly to replace `unknown` guards in sections above.
- Prefer **narrow casts only after a guard**. Avoid broad `as any` or large object casts.
- If `company`/`applyRaisePolicy` live in different paths, align the import alias per HOTFIX‑01.
