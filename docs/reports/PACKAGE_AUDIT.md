# Package Audit — Seed Tooling (AJV-free)

_Audit date: 2025-10-06T07:03:26Z_

## Scope & Inputs

- Parsed `package.json` for the root workspace and `packages/*` (pnpm workspaces).
- Parsed `pnpm-lock.yaml` to resolve the concrete versions per importer.
- Parsed `package-lock.json` (no candidates present — legacy file only).
- Searched `packages/*/src/**` for direct imports/requires of candidate packages.

## Findings

| Package | Wanted | Installed? | Version | Location(s) | Direct Usage?* | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `uuid` | `^9` | ✅ | `13.0.0` | `@wb/engine` (`dependencies`) | `@wb/engine: packages/engine/src/shared/determinism/ids.ts` | Existing sha256-based `deterministicUuid` helper under `packages/engine/src/backend/src/util/uuid.ts`; coordinate before replacing runtime code. v7 API required bumping to the `13.x` stream. |
| `xxhash-wasm` | `^1` | ✅ | `1.1.0` | `@wb/engine` (`dependencies`) | `@wb/engine: packages/engine/src/shared/determinism/hash.ts` | Current npm release only exposes 64-bit helpers; stub composes 128-bit output via dual seeds. |
| `safe-stable-stringify` | `^2` | ✅ | `2.5.0` | `@wb/engine` (`dependencies`) | `@wb/engine: packages/engine/src/shared/determinism/hash.ts` | |
| `globby` | `^14` | ✅ | `14.1.0` | `@wb/tools` (`dependencies`) | `@wb/tools: packages/tools/src/lib/packageAudit.ts` | |
| `psychrolib` | `^2` | ✅ | `1.1.0` | `@wb/engine` (`dependencies`) | `@wb/engine: packages/engine/src/shared/psychro/psychro.ts` | Upstream has not published the `^2` train yet; holding on `1.1.0`. Review before promoting beyond test scaffolds. |
| `mathjs` | `^13` | ❌ | — | — | — | Tree-shake via named imports only when introduced. |
| `@turf/turf` | `^7` | ❌ | — | — | — | |
| `zod-to-json-schema` | `^3` | ❌ | — | — | — | |
| `type-fest` | `^4` | ❌ | — | — | — | |
| `rxjs` | `^7` | ❌ | — | — | — | |
| `mitt` | `^3` | ❌ | — | — | — | |
| `eventemitter3` | `^5` | ❌ | — | — | — | |
| `commander` | `^12` | ✅ | `12.1.0` | `@wb/tools` (`dependencies`) | `@wb/tools: packages/tools/src/cli/report.ts` | |
| `pino` | `^9` | ✅ | `9.13.1` | `@wb/tools` (`dependencies`) | `@wb/tools: packages/tools/src/lib/logger.ts` | Pretty transport disabled by default; opt-in via env. |
| `pino-pretty` | `^11` | ✅ | `11.3.0` | `@wb/tools` (`dependencies`) | — | Wired as optional transport target only. |
| `cli-table3` | `^0.6` | ✅ | `0.6.5` | `@wb/tools` (`dependencies`) | `@wb/tools: packages/tools/src/cli/report.ts` | |
| `fast-check` | `^3` | ✅ | `3.23.2` | `@wb/engine` (`devDependencies`) | — | Tests-only; no production import. |
| `vitest-fetch-mock` | `^0.4` | ❌ | — | — | — | |
| `msw` | `^2` | ❌ | — | — | — | |
| `neo-blessed` | `^0.2` | ❌ | — | — | — | Optional monitor tooling; defer until terminal UX sprint. |
| `blessed-contrib` | `^5` | ❌ | — | — | — | Optional monitor tooling; defer until terminal UX sprint. |

> *Direct usage = imports/requires within `packages/*/src/**`.

## Greenlist (Safe to Continue)

- `uuid`, `xxhash-wasm`, `safe-stable-stringify` — deterministic scaffolds only; no production wiring yet.
- `globby`, `commander`, `cli-table3`, `pino`, `pino-pretty` — tooling/CLI scope only.
- `fast-check` — tests-only, improves property coverage.

## Review (Needs Design/Version Check)

- `psychrolib` — npm still on `1.1.0`; upgrading to the desired `^2` requires upstream release or vendor fork.
- `pino-pretty` — keep transport opt-in to avoid noisy CI logs.

## Skip (Out-of-scope for this pass)

- Geometry/pipeline/event helpers (`mathjs`, `@turf/turf`, `rxjs`, `mitt`, `eventemitter3`).
- Schema/typing utilities (`zod-to-json-schema`, `type-fest`).
- Mocking/terminal tooling (`vitest-fetch-mock`, `msw`, `neo-blessed`, `blessed-contrib`).

## No-Go Criteria

- Introduce runtime UUID/hash replacements without aligning with existing deterministic helpers (`packages/engine/src/backend/src/util/uuid.ts`).
- Adopt `psychrolib` in production flows before we can target a maintained `^2` release (or validate `1.x` compatibility formally).
- Pull `mathjs` without a clear tree-shaking plan; risk of large bundle footprint.

