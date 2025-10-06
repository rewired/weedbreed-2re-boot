# Pest & Disease System MVP

**ID:** 0005  
**Status:** Planned  
**Owner:** unassigned  
**Priority:** P0  
**Tags:** backend, simulation, tasks, telemetry

## Rationale
Biosecurity is core to the simulation: [SEC §8.5 Pests & Diseases](../SEC.md#85-pests--diseases-health--biosecurity) mandates deterministic risk accumulation, inspection/treatment tasks, quarantine intervals, and telemetry warnings. Tasks and treatments must align with the catalog in [SEC §3.3](../SEC.md#33-task--treatment-catalogs-data-driven). The risk-management pillar in [VISION_SCOPE §1 Experience Pillars](../VISION_SCOPE.md#1-vision) reinforces the gameplay need. We must deliver an MVP pipeline respecting these requirements.

## Scope
- Include: deterministic risk scoring per zone/room based on environment and hygiene inputs, inspection task scheduling, treatment task emission with cooldowns/quarantine windows.
- Include: telemetry and read-model updates surfacing risk levels and task emissions.
- Include: integration of quarantine windows affecting workforce scheduling and economy hooks as required.
- Out of scope: advanced pathogen modelling beyond risk scores; new UI flows beyond telemetry/read-model outputs.

## Deliverables
- Risk scoring module consuming environment/hygiene signals and outputting normalized risk values per SEC guidance.
- Scheduler logic generating inspection and treatment tasks using the catalog (codes, required skills) with deterministic cooldowns/quarantine intervals.
- Telemetry/read-model updates reporting risk states and emitted tasks; documentation updates describing the workflow.
- Scenario integration test demonstrating expected task emissions over a representative run.

## Implementation Steps
1. Define data structures for risk sources (environmental thresholds, hygiene signals) and implement deterministic accumulation respecting SEC invariants.
2. Integrate risk evaluation into the tick pipeline (likely during workforce or economy stages) and trigger inspection/treatment tasks when thresholds crossed.
3. Implement quarantine window handling: mark affected zones, suppress conflicting tasks, and record timers.
4. Emit telemetry events and update read-model projections reflecting risk levels, scheduled tasks, and quarantine status.
5. Write scenario integration test (e.g., multi-day run) validating risk progression, task emissions, and quarantine enforcement; update docs/CHANGELOG.

## Acceptance Criteria / DoD
- Risk scores evolve deterministically given identical inputs; tests confirm consistent values across runs.
- Inspection and treatment tasks are emitted using catalog codes with deterministic cooldowns and quarantine windows; conflicting tasks blocked during quarantine.
- Telemetry/read-model surfaces risk warnings and task events aligned with SEC requirements; scenario test validates expected sequence.
- Documentation (SEC references if clarifications added) and CHANGELOG updated with the MVP scope.

## Tests
- Unit tests: risk scoring pure functions, quarantine timer management, task emission thresholds.
- Integration tests: scenario run in `packages/engine/tests/integration/pipeline/pestDiseaseMvp.integration.test.ts` verifying risk progression, tasks, and telemetry outputs over multiple days.
- CI gates: ensure conformance hashes unchanged when risk disabled, and new specs included in pnpm test suite.

## Affected Files (indicative)
- `packages/engine/src/backend/src/health/pestDiseaseRisk.ts`
- `packages/engine/src/backend/src/workforce/taskScheduler.ts`
- `packages/engine/tests/unit/health/pestDiseaseRisk.spec.ts`
- `packages/engine/tests/integration/pipeline/pestDiseaseMvp.integration.test.ts`
- `docs/SEC.md` ([§3.3](../SEC.md#33-task--treatment-catalogs-data-driven), [§8.5](../SEC.md#85-pests--diseases-health--biosecurity))
- `docs/VISION_SCOPE.md` ([Experience Pillars](../VISION_SCOPE.md#1-vision))
- `docs/CHANGELOG.md`

## Risks & Mitigations
- **Risk:** Risk model drifts from SEC guidance. **Mitigation:** Keep formulas documented and aligned with SEC thresholds; add golden vector tests.
- **Risk:** Task spam overwhelms workforce scheduling. **Mitigation:** Implement cooldowns/quarantine windows per SEC and verify via integration tests.
- **Risk:** Telemetry noise. **Mitigation:** Aggregate risk warnings per tick and ensure channels remain read-only as per SEC §11.
