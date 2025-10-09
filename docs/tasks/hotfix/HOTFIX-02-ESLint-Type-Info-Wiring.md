# HOTFIX-02 — ESLint korrekt mit Type-Info verdrahten

**Goal:** Ensure ESLint has full TS program info to avoid `error type`/`any` fallbacks.

## Required Changes
1. Root `.eslintrc.cjs` / `.eslintrc.js`:
```js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: [
      'packages/*/tsconfig.json',
      'packages/*/tsconfig.spec.json'
    ],
    tsconfigRootDir: __dirname,
    sourceType: 'module'
  },
  // … existing config (rules/plugins/extends) stays …
};
```
2. Verify every testing package provides a `tsconfig.spec.json` (see HOTFIX-01).

## Rationale
When ESLint can't load the TS project, it treats many nodes as `error`/`any`, triggering `no-unsafe-*` everywhere.

## Acceptance Criteria
- `pnpm -w eslint "packages/**/*.{ts,tsx}"` yields **no mass errors** due to missing type info.
- Subsequent unsafe errors reflect *real* issues, not configuration drift.
