# UI Workspace Bootstrap

**ID:** 0026
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, ui, tooling, track-4

## Rationale
We need a dedicated React + Vite workspace aligned with the monorepo conventions before building telemetry binders or UI surfaces. Bootstrapping the package establishes routing, Tailwind configuration, and base layout plumbing for subsequent tasks.

## Scope
- In: create `packages/ui` with Vite (React, TypeScript, ESM) scaffold wired into pnpm workspaces.
- In: configure Tailwind + shadcn/ui baseline, shared design tokens, and lint/test scripts.
- Out: feature-specific components (handled by follow-up tasks).

## Deliverables
- `packages/ui/package.json`, Vite config, Tailwind config, and base `src/App.tsx` rendering a placeholder shell with left rail + main content slots.
- Workspace wiring updates: `pnpm-workspace.yaml`, root scripts, and Git ignore entries if required.
- `packages/ui/README.md` describing dev commands and environment variables.

## Acceptance Criteria
- `pnpm install` succeeds with the new workspace and `pnpm --filter @wb/ui dev` launches Vite.
- Base layout renders left rail + main content placeholder without runtime errors.
- Lint/test scripts (e.g., `pnpm --filter @wb/ui lint`/`test`) are defined even if tests are stubbed.
- Documentation captures setup steps, Node 22 expectation, and how to run the dev server alongside façade.

## References
- [Proposal §4](../../proposals/20251009-mini_frontend.md#4-ui-surfaces-data-flows)
- [AGENTS §1](../../AGENTS.md#1-platform-monorepo-must-haves)
- [TDD §2](../../TDD.md#2-tooling-and-workflow)
