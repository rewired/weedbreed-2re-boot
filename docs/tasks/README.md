# Task Backlog

| ID   | Title | Priority | Status | Owner | Links | Resolved |
| ---- | ----- | -------- | ------ | ----- | ----- | -------- |
| 0001 | Golden Master & Conformance Suite | P0 | Planned | unassigned | [task](./0001-golden-master-and-conformance-suite.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0002 | Appendix B Crosswalk Fill | P0 | Planned | unassigned | [task](./0002-appendix-b-crosswalk-fill.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0003 | Sensors Stage Content and Noise Model | P0 | Planned | unassigned | [task](./0003-sensors-stage-content-and-noise-model.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0004 | CO₂ Actuator and Environment Coupling | P0 | Planned | unassigned | [task](./0004-co2-actuator-and-environment-coupling.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0005 | Pest & Disease System MVP | P0 | Planned | unassigned | [task](./0005-pest-disease-system-mvp.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0006 | Save/Load and Migrations | P0 | Planned | unassigned | [task](./0006-save-load-and-migrations.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0007 | Device Degradation and Maintenance Flows | P1 | Planned | unassigned | [task](./0007-device-degradation-and-maintenance-flows.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0008 | Economy Accrual Consolidation | P1 | Planned | unassigned | [task](./0008-economy-accrual-consolidation.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0009 | Cultivation Method Tasks Runtime | P1 | Planned | unassigned | [task](./0009-cultivation-method-tasks-runtime.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0010 | VPD and Stress Signals Finalization | P1 | Planned | unassigned | [task](./0010-vpd-and-stress-signals-finalization.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0011 | Transport Adapter Hardening | P1 | Planned | unassigned | [task](./0011-transport-adapter-hardening.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0012 | Blueprint Taxonomy v2 Loader Tests | P2 | Planned | unassigned | [task](./0012-blueprint-taxonomy-v2-loader-tests.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0013 | Open Questions to ADRs | P2 | Planned | unassigned | [task](./0013-open-questions-to-adrs.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0014 | Performance Budget in CI | P2 | Planned | unassigned | [task](./0014-performance-budget-in-ci.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0015 | Terminal Monitor MVP | P2 | Planned | unassigned | [task](./0015-terminal-monitor-mvp.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |

## How to work with tasks
- **Branch naming:** use `feature/<task-id>-short-slug` (e.g., `feature/0004-co2-coupling`) so CI links back to the task.
- **PR checklist:** reference the task ID, cite relevant SEC/DD/TDD sections, update CHANGELOG/ADR if contracts change, and include test results proving the Acceptance Criteria.
- **DoD & tests:** align commits with the task’s Acceptance Criteria / DoD section. Attach CI logs or local runs for the listed tests (unit, integration, perf) when opening PRs.
- **When done:** check the resolved tickmark for the current task in this file, add ADR if useful, align [AGENTS](../../AGENTS.md), [DD](../DD.md), [TDD](../TDD.md), [SEC](../SEC.md), [VISION_SCOPE](../VISION_SCOPE.md), if needed.