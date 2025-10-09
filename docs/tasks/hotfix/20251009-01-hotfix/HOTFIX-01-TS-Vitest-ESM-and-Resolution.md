# HOTFIX-01 — TypeScript & Vitest: ESM/Resolution richtig stellen

**Goal:** Stop the `error type` cascade by fixing TS module resolution, ESM config, and Vitest aliases.

## Required Changes
1. Create/align `packages/engine/tsconfig.spec.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```
2. Update `packages/engine/vitest.config.ts` to point aliases to **source** (not `dist`):
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/backend': path.resolve(__dirname, 'src/backend/src'),
      '@wb/engine': path.resolve(__dirname, 'src/index.ts')
    }
  },
  test: { environment: 'node' }
});
```
3. If other packages expose aliases, mirror the same pattern there.

## Rationale
Vitest + ESM + monorepo aliases often degrade to `error`/`any` when resolution is off. This task removes the root cause.

## Acceptance Criteria
- `pnpm -w tsc -p packages/engine/tsconfig.spec.json --noEmit` finishes with **0 TS errors**.
- No `Cannot find module…` or alias-related errors in Vitest; the mass of `no-unsafe-*` caused by `error type` disappears.
