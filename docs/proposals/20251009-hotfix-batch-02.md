# HOTFIX‑042 — ESLint Cleanup & Constants Extraction (Engine + Facade + Tests)

**Date:** 2025‑10‑09
**Owner:** unassigned
**Priority:** P0 (blocks CI)
**Scope:** packages/engine, packages/facade, packages/tools, packages/tools-monitor (lint + minimal refactors, no behavior changes beyond logging/strings)

---

## 0) Problem Statement (Summary)

Current `pnpm -r lint`/`vitest` runs surface **835 problems** (372 errors, 463 warnings). The most impactful classes:

1. **Magic numbers** sprinkled across engine, stubs, util, and tests.
2. **`@typescript-eslint/restrict-template-expressions`** due to interpolating non‑string values directly.
3. **`no-unnecessary-condition` / optional chaining on non‑nullable**: dead or misleading branches.
4. **`no-dynamic-delete`**: deleting dynamic keys from objects.
5. **Unsafe `any`/`error` handling** in `catch`, args, and returns.
6. **Percent identifiers in engine** (`wb-sim/no-engine-percent-identifiers`): UI formatting leaking into core.
7. **`parserOptions.project` errors for test files**: ESLint TS‑program not finding test files.
8. Minor: unnecessary type conversions/assertions, unused vars, `prefer-nullish-coalescing`, `require-await`.

**Goal:** Reduce lint errors to **0** and warnings to **≤ 30** (temporary), with durable guardrails so regressions don’t reappear.

---

## 1) Guardrail First: Central Constants + Helpers

Create/extend a single source of truth for canonical numeric constants and formatting helpers.

**New/updated files**

* `packages/engine/src/backend/src/constants/simConstants.ts`
* `packages/engine/src/backend/src/constants/goldenMaster.ts`
* `packages/engine/src/backend/src/util/format.ts`

```ts
// simConstants.ts
/** Engine‑internal scales are 0..1; UI maps to percent. */
export const EPS_ABS = 1e-9;
export const EPS_REL = 1e-6;
export const HOURS_PER_DAY = 24;
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;

// Perf baselines + budgets (engine‑internal, 0..1 where applicable)
export const PERF_CPU_BUDGET_MB = 1024; // example from perfBudget.ts
export const PERF_MEM_BUDGET_MB = 1024;

// Common sample sizes / steps used in reports or hash windows
export const HASH_KEY_BYTES = 16;
export const HASH_TRUNC_BYTES = 24;

// Workforce tuning primaries (documented; do NOT inline in logic)
export const DEFAULT_PROB_LOW = 0.01;
export const DEFAULT_PROB_MED = 0.25;
export const DEFAULT_PROB_HIGH = 0.5;
```

```ts
// goldenMaster.ts
export const GM_DAYS_SHORT = 30;
export const GM_DAYS_LONG = 200;
```

```ts
// util/format.ts
export const toStr = (v: unknown) => (typeof v === "string" ? v : String(v));
export const fmtNum = (n: number) => String(n); // stable, minimal; UI applies locale/rounding
```

**Codex hint:** Replace scattered literals (e.g., `30`, `200`, `16`, `24`, `1024`) with imports from these modules where semantically identical. If a literal is domain‑specific (e.g., workforce market tweak), hoist it to a local `const` with JSDoc in the same file under a `// region Constants` block.

---

## 2) Fix Patterns by Rule Category

### 2.1 `restrict-template-expressions` (Engine, Facade, Tests)

**Symptom:** Template literals interpolating numbers/unions (e.g., `\`${days}d``with`days: 30 | 200`).

**Fix:** Import `toStr`/`fmtNum` or cast to string explicitly. When unions are involved, narrow first.

```ts
// BEFORE
const label = `${days}d`;
// AFTER
const label = `${fmtNum(days as number)}d`;

// Or: narrow using a helper
function asDayCount(d: 30 | 200 | number): number { return d as number; }
const label = `${fmtNum(asDayCount(days))}d`;
```

Apply to: `runDeterministic.ts`, `updateGoldenFixtures.ts`, `perfScenarios.ts`, `seedToHarvest.ts`, `saveLoad/…/registry.ts`, `saveManager.ts`, `workforce/market.ts`, `raises.ts`, facade transport tests, etc.

---

### 2.2 Magic Numbers (`no-magic-numbers`)

**Strategy:**

1. If **truly global** (calendar, hash sizes, perf budgets) ⇒ move to `simConstants.ts`.
2. If **module‑local semantics** (e.g., humidity actuator thresholds) ⇒ local `const` + JSDoc.
3. If **test‑only fixtures** ⇒ `tests/constants.ts` per package.

**Examples:**

* Golden master horizons: replace `30`, `200` ⇒ `GM_DAYS_SHORT`, `GM_DAYS_LONG`.
* Hash truncation/sizes: replace `16`, `24` ⇒ `HASH_KEY_BYTES`, `HASH_TRUNC_BYTES`.
* Perf percentages in engine: convert to 0..1 **and** rename fields (see 2.3).
* Workforce markets (0.01/0.34/0.68/…): hoist into `const` with readable names (`HIREDROP_PROB_MIN`, …) next to the function.

**Tests:** Add `packages/**/tests/constants.ts` for repeated fixture numbers (e.g., PPFD, hours, percent splits).

---

### 2.3 Engine Percent Identifiers (`wb-sim/no-engine-percent-identifiers`)

**Symptom:** Fields/identifiers contain `Percent`/`%` semantics inside **engine** modules (e.g., `perfBudget.ts`).

**Fix:**

* **Rename** internal fields to `*01` (0..1 scale). Mapping to percent happens at façade/read‑models only.
* Replace any calculations that assume `0..100` with `0..1` equivalents, adjust constants accordingly.
* If logs/strings need percent for readability, compute local `%` **strings** in logging only (don’t store as state).

**Example:**

```ts
// BEFORE (engine)
interface PerfBudget { cpuPercent: number; memPercent: number; }
// AFTER
interface PerfBudget { cpu01: number; mem01: number; }
```

Add a small migration shim if read‑models referenced old names (compile will reveal).

---

### 2.4 Unnecessary Conditions / Optional Chains

**Symptom:** `??` on non‑nullable, `?.` on non‑nullish, tautological comparisons (`"auto" === "auto"`).

**Fix:** Remove the branch or invert with a proper guard. Where types are wrong, refine types instead of keeping branches.

```ts
// BEFORE
if ((mode ?? "auto") === "auto") { /* always true */ }
// AFTER
if (mode === "auto") { /* … */ }
```

Apply aggressively in: pipeline effects (`humidity.ts`), `applyDeviceEffects.ts`, `applyIrrigationAndNutrients.ts`, `updateEnvironment.ts`, workforce modules, etc.

---

### 2.5 `no-dynamic-delete`

**Symptom:** `delete obj[key]` on dynamic keys.

**Fix options:**

* Prefer **immutable rest** pattern:

```ts
const { [key]: _removed, ...rest } = obj; obj = rest; // or return rest
```

* Or switch to `Map` and call `map.delete(key)` if semantics fit.
* If truly marking as absent is sufficient, set `obj[key] = undefined` (but beware JSON serialization differences).

Targets: `applyDeviceEffects.ts`, `applyIrrigationAndNutrients.ts`, `applySensors.ts`, `workforce/index.ts`.

---

### 2.6 Unsafe `any`/`error` (`no-unsafe-argument`, `use-unknown-in-catch-callback-variable`)

**Fix recipe:**

```ts
try {
  // …
} catch (err: unknown) {
  const e = err instanceof Error ? err : new Error(String(err));
  log.error(e.message, { stack: e.stack });
}
```

* For function parameters expecting concrete types, validate/cast at the edge (zod/schema or manual guards). Do **not** pass `any`/`error` directly.
* In telemetry emitters, construct typed payloads explicitly; avoid spreading `any` objects.

Apply to: `util/photoperiod.ts`, `physiology/vpd.ts`, `engine/reporting/cli.ts`, façade `transport/server.ts`, `workforce` telemetry, etc.

---

### 2.7 Unnecessary type conversions/assertions

* Remove `Number(x)` where `x` is already `number`.
* Remove `as SomeType` assertions that don’t change type.
* Replace non‑null assertions (`!`) with explicit guards or schema validation at boundaries.

Files: `perfScenarios.ts`, `engine/index.ts`, `stubs/*`, façade tests.

---

### 2.8 `prefer-nullish-coalescing` & `prefer-nullish-coalescing` (assignment)

* Replace `a = a || b` with `a ??= b` when `a` can be `null | undefined` and falsy values are valid.
* Replace `x || y` with `x ?? y` when `0`/`""` are valid.

Files: `engine/reporting/cli.ts`, `shared/determinism/hash.ts`, `generateSeedToHarvestReport.ts`.

---

## 3) ESLint Program for Tests (Fix `parserOptions.project`)

**Symptom:** “The file was not found in any of the provided project(s)” for every test file.

**Fix (preferred):** Introduce **`tsconfig.eslint.json`** at `packages/engine/` including both `src` and `tests`.

**New file:** `packages/engine/tsconfig.eslint.json`

```json
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Update:** `packages/engine/.eslintrc.cjs`

```js
module.exports = {
  parserOptions: {
    project: ['./tsconfig.eslint.json']
  }
}
```

**Alternative (quick):** In root ESLint config, add an **override** for test files that disables type‑aware rules (not recommended long‑term):

```js
{
  files: ['**/tests/**/*.{ts,tsx}'],
  parserOptions: { project: null },
  rules: { '@typescript-eslint/no-unsafe-*': 'off', '@typescript-eslint/restrict-template-expressions': 'off' }
}
```

---

## 4) File‑Specific Notes (Non‑exhaustive, prioritized)

* **engine/conformance/**: replace `30|200` with `GM_DAYS_*`; use `fmtNum`.
* **engine/perf/perfBudget.ts**: rename internal `*Percent` → `*01`; hoist `0.2/0.4` to `const` or reuse existing thresholds.
* **pipeline/** (`applyDeviceEffects.ts`, `applyIrrigationAndNutrients.ts`, `applySensors.ts`, `updateEnvironment.ts`): remove impossible branches; replace deletes; validate inputs earlier to avoid `??` on non‑nullable.
* **physiology/vpd.ts** & **util/photoperiod.ts**: adopt `catch (e: unknown)` pattern; never return raw `error`. Return `Result`‑like object or throw and let caller handle.
* **saveLoad/migrations/registry.ts**: remove `unknown` from unions where it swallows types; concrete discriminated unions preferred.
* **services/workforce/**: hoist market probabilities to named `const` near usage; remove redundant `??`/`?.` chains; fix template strings via `fmtNum`.
* **stubs/**: replace `!` with explicit checks; unused `clamp` import in `LightEmitterStub.ts` → remove.
* **shared/determinism/hash.ts**: use `??=` assignment form.
* **facade/transport**: enforce `catch (e: unknown)` and guard all `any` from Express/Socket payloads.

---

## 5) Acceptance Criteria

* **AC‑1:** `pnpm -r lint` returns **0 errors**, warnings **≤ 30** (temporary cap).
* **AC‑2:** No functional regression in unit/integration tests; golden master hashes unchanged (unless string label changes are asserted—update tests accordingly).
* **AC‑3:** All engine internals avoid percent identifiers; scales are 0..1.
* **AC‑4:** All template literals either interpolate strings or use `fmtNum`.
* **AC‑5:** Tests are included in ESLint program; no `parserOptions.project` errors.
* **AC‑6:** New/changed constants are documented with JSDoc; names are semantically meaningful.

---

## 6) Step‑by‑Step Plan (for Codex)

1. **Create constants & helpers** (Section 1). Update imports where needed.
2. **Conformance & reporting**: swap golden‑day literals → `GM_DAYS_*`; fix template strings.
3. **Perf budget**: rename internal percent fields to `*01`. Replace literals `0.2/0.4` with named `const`.
4. **Pipelines**: remove tautologies; replace dynamic `delete` with rest/Map; simplify nullish flows.
5. **Safety**: standardize `catch (e: unknown)` and edge validation; stop returning `error` values.
6. **Workforce**: hoist probabilities; fix `??`/`?.` misuse; remove non‑null `!`.
7. **Stubs & utils**: clean imports, remove unreachable code, convert percentages.
8. **ESLint config for tests**: add `tsconfig.eslint.json` + `.eslintrc.cjs` override as above.
9. **Run:** `pnpm -r lint && pnpm -r test`. If any golden strings changed, adjust only the **expected strings** (hashes must remain).
10. **Docs:** add a brief note to `/CHANGELOG.md` under **Fixed** and update `/docs/constants/README.md` if present.

---

## 7) Non‑Goals / Out of Scope

* Rebalancing gameplay numbers (only naming/placement of constants).
* Changing device/physiology algorithms.
* Introducing new economy units or tariff models.

---

## 8) Risk & Mitigation

* **Risk:** Renaming percent fields may break read‑models.
  **Mitigation:** Type‑driven compile errors; add mapping at façade if needed and update tests.
* **Risk:** Removing `delete` changes JSON output (undefined vs absent).
  **Mitigation:** Use immutable rest to truly remove key when serialization matters; add unit test if necessary.
* **Risk:** Converting magic numbers could accidentally unify unrelated semantics.
  **Mitigation:** Only hoist when meaning is identical; otherwise local `const` with JSDoc.

---

## 9) Example Patches (Illustrative)

```ts
// engine/conformance/updateGoldenFixtures.ts
import { GM_DAYS_LONG, GM_DAYS_SHORT } from "../../constants/goldenMaster.js";
import { fmtNum } from "../../util/format.js";

const RUNS: ReadonlyArray<30 | 200> = [GM_DAYS_SHORT as 30, GM_DAYS_LONG as 200];
for (const days of RUNS) {
  const tag = `${fmtNum(days)}d`;
  // …
}
```

```ts
// engine/perf/perfBudget.ts (excerpt)
const WARN_THRESHOLD01 = 0.2 as const;
const ALERT_THRESHOLD01 = 0.4 as const;

export interface PerfBudget { cpu01: number; mem01: number; }
```

```ts
// pipeline/applyDeviceEffects.ts — remove dynamic delete
const { [deviceId]: _removed, ...remaining } = zone.devices; // immutable remove
zone.devices = remaining;
```

```ts
// util/photoperiod.ts — safe catch/return
export function calcPhotoperiod(/* … */): PhotoperiodResult {
  try {
    // …
    return ok;
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    throw err; // callers handle with try/catch, not returning `error`
  }
}
```

---

## 10) CI Hook (temporary)

Add a temporary warning budget to prevent backsliding while we refactor.

* Root `package.json`:

```json
{
  "scripts": {
    "lint:strict": "pnpm -r lint && node tools/check-warn-budget.mjs 30"
  }
}
```

* `tools/check-warn-budget.mjs` (optional helper that parses ESLint JSON and fails if warnings > budget).

---

## 11) Definition of Done

* ✅ All listed errors resolved, warnings under cap.
* ✅ Constants centralized; percent identifiers removed from engine.
* ✅ Tests lintable (no `parserOptions.project` errors).
* ✅ PR includes rationale + links to this HOTFIX doc; CHANGELOG updated.
