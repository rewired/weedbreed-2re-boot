# Global Shell & Sim Control Bar

**ID:** 0100
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, navigation, shell

## Rationale
Implement the persistent workspace frame (left rail, sticky content pane, always-visible sim control bar) mandated by the frontend proposal so navigation and control affordances line up with SEC-aligned expectations.
Locking down this shell unblocks downstream structure/room/zone modules and keeps layout semantics consistent across breakpoints.

## Scope
- In:
  - Persistent left rail with Company → Structures → HR → Strains ordering, collapsible/mini-rail behavior, and breadcrumb hooks that live inside the content pane.
  - Sticky content pane layout that keeps the sim control bar outside the scrollable area on desktop and mobile while respecting responsive constraints.
  - Sim control bar component exposing play/pause, step, and speed chips (1×/5×/10×/25×/100×), tick clock, and balance + Δ/hour readouts with intent dispatch stubs.
  - Navigation/i18n formatting glue so locale formatting (DE/EN) applies to shell-level metrics without breaking determinism.
- Out:
  - Detailed Structure/Room/Zone or HR content tiles (delivered by follow-on modules).
  - Real telemetry/economy data sourcing beyond existing stubs for balance or tick cadence.

## Deliverables
- Update workspace layout scaffolding under `packages/ui/src/layout/WorkspaceLayout.tsx` and related wrappers to mount the sim control bar and enforce sticky behavior.
- Extend `packages/ui/src/components/layout` with a production-ready `LeftRail` and new `SimControlBar` component plus responsive CSS/tailwind tokens.
- Adjust `packages/ui/src/routes/workspaceRoutes.tsx` and `packages/ui/src/lib/navigation.ts` to ensure routing/guards respect the shell.
- Refresh copy/tokens in `packages/ui/src/design/tokens.ts` to cover new labels/tooltips for the control bar and navigation.
- Add interaction tests in `packages/ui/src/components/layout/__tests__` to cover collapsible left rail behavior and control bar visibility across breakpoints.
- Document the shell introduction in `docs/CHANGELOG.md`.

## Acceptance Criteria
- Left rail consistently lists Company, Structures, HR, and Strains (with placeholder affordance for future sections), collapses on narrow viewports, and highlights the active item without overlapping the sim control bar.
- The sim control bar remains visible (top on desktop, bottom on mobile) with working play/pause, step, and speed toggles exactly at 1×/5×/10×/25×/100× plus read-only tick clock and balance Δ/hour fields sourced from the read model layer.
- Workspace layout keeps the control bar outside the scrollable content pane and prevents navigation/control overlaps on all supported viewport breakpoints.
- Locale-aware formatting (DE/EN) is applied to shell-level numbers/time without regressing navigation guards or breadcrumbs placement within the content pane.

## References
- docs/proposals/20251013-ui-plan.md §0.1–0.3, §10
- AGENTS.md (root) — SEC v0.2.1 alignment guardrails
