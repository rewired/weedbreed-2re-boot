# HOTFIX-04 — Test-Utility „Expectors“: Guards statt Non-Null/Any

**Goal:** Remove real unsafe patterns from tests using small guard helpers—no `!`, no raw `any`.

## Required Changes
1. Add `packages/engine/tests/util/expectors.ts`:
```ts
export function expectDefined<T>(val: T | null | undefined): T {
  expect(val).toBeDefined();
  return val as T;
}

export function asObject(e: unknown): Record<string, unknown> | null {
  return e && typeof e === 'object' ? (e as Record<string, unknown>) : null;
}

export function hasKey<T extends string>(
  o: Record<string, unknown> | null,
  k: T
): o is Record<T, unknown> {
  return !!o && Object.prototype.hasOwnProperty.call(o, k);
}

export function toNumber(x: unknown): number {
  expect(typeof x).toBe('number');
  return x as number;
}

export function toBigInt(x: unknown): bigint {
  expect(typeof x === 'bigint' || typeof x === 'number').toBe(true);
  return typeof x === 'bigint' ? x : BigInt(x as number);
}
```
2. Refactor failing tests (`raises.test.ts`, `hash.test.ts`, Stubs, etc.):
   - Replace **all** `!` with `expectDefined()`.
   - Normalize arithmetic operands with `toNumber()` / `toBigInt()`.
   - Guard unknown objects via `asObject()` + `hasKey()` before property access.

## Rationale
This keeps tests type-safe and readable while retaining strict ESLint rules.

## Acceptance Criteria
- No hits for `@typescript-eslint/no-non-null-assertion` in tests.
- No `restrict-plus-operands` or guardable `no-unsafe-*` in tests after refactor.
- Domain expectations unchanged (tests still pass).
