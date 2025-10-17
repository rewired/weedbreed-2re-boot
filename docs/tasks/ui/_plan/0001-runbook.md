# Frontend Live Data Wiring Runbook

## Execution Order
1. **Phase 0 – Contracts & Documentation**
   - 0100 → 0110 → 0130 → 0120
2. **Phase 1 – Backend Scenario & Hydration**
   - 1100 → 1110 → 1120 → 1130
3. **Phase 2 – Telemetry & Playback**
   - 2100 → 2120 → 2110 → 2130
4. **Phase 3 – Intent Coverage & Control Flows**
   - 3100 → 3110 → 3120 → 3130
5. **Phase 4 – Frontend Wiring to Live Data**
   - 4100 → 4110 → 4120 → 4130 → 4140
6. **Phase 5 – Validation & Documentation**
   - 5150 → 5170 → 5160 → 5180

## Pre-Flight Checklist
- **General**: confirm Node.js 22 environment, install deps via `pnpm install`, ensure façade/backend dev servers idle.
- **Documentation tasks (Phase 0 & 5)**: open SEC/DD/TDD/ADR files, gather task IDs for cross-references, prepare markdown lint (`pnpm lint:docs`).
- **Loader/Hydration tasks (1100–1130)**: identify deterministic seed, collect blueprint and price-map fixture paths, note expected world hierarchy for assertions.
- **Telemetry tasks (2100–2130)**: confirm playback controller entry point, existing Socket.IO namespaces, and schema validation utilities.
- **Intent tasks (3100–3130)**: enumerate current stub handlers, correlation ID utilities, and validation helpers; prepare sample payload fixtures.
- **Frontend wiring tasks (4100–4140)**: verify store modules, hook/component paths, and available mock utilities (testing-library, MSW) for deterministic tests.
- **Testing & Docs closure (5150–5180)**: catalogue new/updated test suites, ensure deterministic seeds recorded, and update CHANGELOG/ADR templates.

## Execute Task Prompt
```
Program: Execute Task
Inputs:
  TASK_FILE: docs/tasks/ui/<task-file-name>.md
```
