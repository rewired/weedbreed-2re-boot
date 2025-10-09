# HOTFIX-07 — CI-Gates & Dev-Kommandos (DoD)

**Goal:** Add regression guards and clear local commands to keep the repo healthy.

## Required Changes
1. Root `package.json` scripts (adjust paths as needed):
```json
{
  "scripts": {
    "typecheck": "pnpm -w tsc -p packages/engine/tsconfig.spec.json --noEmit",
    "lint": "eslint \"packages/**/*.{ts,tsx}\"",
    "test": "pnpm -r test",
    "prepush": "pnpm typecheck && pnpm lint && pnpm test"
  }
}
```
2. CI pipeline (GitHub Actions):
   - Steps in order: `typecheck → lint → test`.
   - Enforce `--max-warnings 0` on ESLint.
   - Fail fast if any step fails.

## Rationale
Prevents regressions; keeps `error type`/unsafe cascades from reappearing unnoticed.

## Acceptance Criteria
- `pnpm typecheck` → 0 errors.
- `pnpm lint` → 0 errors and (preferably) 0 warnings.
- `pnpm -r test` → green.
- A representative formerly failing test (e.g., `raises.test.ts`) is now free of `!` and `no-unsafe-*` hits.
