ID: 0018
# Terminal Monitor MVP

**ID:** 0015  
**Status:** Planned  
**Owner:** unassigned  
**Priority:** P2  
**Tags:** monitoring, telemetry, docs, frontend

## Rationale
SEC mandates a read-only terminal monitor built on neo-blessed ([SEC §0.1 Platform & Monorepo](../SEC.md#01-platform--monorepo-baseline-technology-choices)) and reiterates telemetry must remain receive-only ([SEC §11.3](../SEC.md#113-transport-policy)). The experience pillar emphasises surfacing KPIs and warnings ([VISION_SCOPE §1](../VISION_SCOPE.md#1-vision)). We need an MVP dashboard aligned with these rules and documented usage.

## Scope
- Include: implement read-only terminal dashboard showing key KPIs (e.g., energy, VPD/stress, task queue, costs) sourced from telemetry/read-models.
- Include: navigation controls (keyboard) without any write capabilities.
- Include: documentation describing setup/usage and limitations.
- Out of scope: intent submission, UI interactions beyond read-only views, theming beyond basic layout.

## Deliverables
- Terminal monitor package/app using neo-blessed that subscribes to telemetry and renders KPIs, warnings, and cost summaries.
- Read-only enforcement (no command inputs) consistent with transport policy.
- Usage documentation (README or docs section) outlining commands, KPIs shown, and alignment with SEC.
- CHANGELOG entry summarising the MVP.

## Implementation Steps
1. Scaffold terminal monitor entrypoint (pnpm workspace) using neo-blessed and connect to telemetry via transport adapter read-only channel.
2. Implement KPI panels (e.g., environment, economy, workforce warnings) with deterministic refresh cadence and navigation (keyboard shortcuts).
3. Ensure monitor enforces read-only behaviour (disable input, guard against command emission) and logs warnings if misconfigured.
4. Document usage in `docs/` (e.g., `docs/tools/terminal-monitor.md`) referencing SEC requirements; update CHANGELOG.

## Acceptance Criteria / DoD
- Terminal monitor runs via pnpm script, connects to telemetry, and displays KPIs/warnings/costs without sending any intents.
- Keyboard navigation works (switch panels, scroll) while input fields remain disabled for commands.
- Documentation explains setup, KPIs, and confirms read-only compliance; CHANGELOG updated.
- Basic smoke test ensures monitor can run headless in CI or manual check (if automation not feasible).

## Tests
- Automated: integration test or script verifying monitor starts, subscribes to telemetry, and does not emit intents (can use transport mocks).
- Manual checklist: run monitor against test harness and confirm KPIs/warnings render.
- CI: optional smoke job to run monitor in headless mode ensuring startup success.

## Affected Files (indicative)
- `packages/monitor-terminal/src/index.ts`
- `packages/monitor-terminal/package.json`
- `packages/monitor-terminal/tests/monitor.smoke.spec.ts`
- `docs/tools/terminal-monitor.md`
- `docs/SEC.md` ([§0.1](../SEC.md#01-platform--monorepo-baseline-technology-choices), [§11.3](../SEC.md#113-transport-policy))
- `docs/VISION_SCOPE.md` ([§1](../VISION_SCOPE.md#1-vision))
- `docs/CHANGELOG.md`

## Risks & Mitigations
- **Risk:** Terminal monitor accidentally emits intents. **Mitigation:** Enforce read-only transport usage and add tests verifying no outbound messages.
- **Risk:** Accessibility/usability issues. **Mitigation:** Provide keyboard navigation and clear labeling; gather feedback for iteration.
- **Risk:** Telemetry schema changes break dashboard. **Mitigation:** Centralize view models and add tests for schema compatibility.
