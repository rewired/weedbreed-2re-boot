# HOTFIX-05 — Number/BigInt-Normalisierung & Result-Unwrapping

**Goal:** Fix issues around `number | bigint` and unsafe `.data/.error` access on result-like objects.

## Required Changes
1. Enforce consistent numeric type per test flow:
   - Choose **either** numbers (`toNumber()`) **or** bigints (`toBigInt()`), do not mix.
2. Add result unwrap helpers (if not present):
```ts
type Ok<T> = { success: true; data: T };
type Err<E = unknown> = { success: false; error: E };

export function unwrap<T>(r: Ok<T>): T { return r.data; }
export function unwrapErr<E>(r: Err<E>): E { return r.error; }
```
3. Replace direct `.data!`/`.error!` usages with `unwrap()`/`unwrapErr()`.

## Rationale
Mixed numerics and blind unwraps trigger multiple ESLint rules. Normalization + helpers keep intent clear and safe.

## Acceptance Criteria
- No `no-unsafe-argument` for `number | bigint` conversions.
- Fewer/no `no-unsafe-member-access` for `.data/.error` in tests.
- Tests retain original semantics.
