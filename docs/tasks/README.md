# Task Backlog

| ID   | Title | Priority | Status | Owner | Links | Resolved |
| ---- | ----- | -------- | ------ | ----- | ----- | -------- |
| 0001 | Appendix B Crosswalk Fill | P0 | Planned | unassigned | [task](./0001-appendix-b-crosswalk-fill.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [x] |
| 0002 | CO₂ Actuator and Environment Coupling | P0 | In Progress | unassigned | [task](./0002-co2-actuator-and-environment-coupling.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0003 | Golden Master & Conformance Suite | P0 | Planned | unassigned | [task](./0003-golden-master-conformance-suite.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0004 | Pest & Disease System MVP | P0 | Planned | unassigned | [task](./0004-pest-disease-system-mvp.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0005 | Save/Load and Migrations | P0 | Planned | unassigned | [task](./0005-save-load-and-migrations.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0006 | Sensors Stage Content and Noise Model | P0 | Planned | unassigned | [task](./0006-sensors-stage-content-and-noise-model.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0007 | Determinism Helper Scaffolds | P1 | In Progress | unassigned | [task](./0007-determinism-helper-scaffolds.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0008 | Package Audit & Reporting Matrix | P1 | In Progress | unassigned | [task](./0008-package-audit-reporting-matrix.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0009 | Psychrometric Wiring Plan | P1 | In Progress | unassigned | [task](./0009-psychrometric-wiring-plan.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0010 | Cultivation Method Tasks Runtime | P1 | Planned | unassigned | [task](./0010-cultivation-method-tasks-runtime.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0011 | Device Degradation and Maintenance Flows | P1 | Planned | unassigned | [task](./0011-device-degradation-and-maintenance-flows.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0012 | Economy Accrual Consolidation | P1 | Planned | unassigned | [task](./0012-economy-accrual-consolidation.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0013 | Transport Adapter Hardening | P1 | Planned | unassigned | [task](./0013-transport-adapter-hardening.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0014 | VPD and Stress Signals Finalization | P1 | Planned | unassigned | [task](./0014-vpd-and-stress-signals-finalization.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0015 | Blueprint Taxonomy v2 Loader Tests | P2 | Planned | unassigned | [task](./0015-blueprint-taxonomy-v2-loader-tests.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0016 | Open Questions to ADRs | P2 | Planned | unassigned | [task](./0016-open-questions-to-adrs.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0017 | Performance Budget in CI | P2 | Planned | unassigned | [task](./0017-performance-budget-in-ci.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |
| 0018 | Terminal Monitor MVP | P2 | Planned | unassigned | [task](./0018-terminal-monitor-mvp.md) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md) | [ ] |

## How to work with tasks
- **Branch naming:** use `feature/<task-id>-short-slug` (e.g., `feature/0004-co2-coupling`) so CI links back to the task.
- **PR checklist:** reference the task ID, cite relevant SEC/DD/TDD sections, update CHANGELOG/ADR if contracts change, and include test results proving the Acceptance Criteria.
- **DoD & tests:** align commits with the task’s Acceptance Criteria / DoD section. Attach CI logs or local runs for the listed tests (unit, integration, perf) when opening PRs.
- **When done:** check the resolved tickmark for the current task in this file, add ADR if useful, align [AGENTS](../../AGENTS.md), [DD](../DD.md), [TDD](../TDD.md), [SEC](../SEC.md), [VISION_SCOPE](../VISION_SCOPE.md), if needed.
