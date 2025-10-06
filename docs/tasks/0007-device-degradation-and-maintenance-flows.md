# Device Degradation and Maintenance Flows

**ID:** 0007  
**Status:** Planned  
**Owner:** unassigned  
**Priority:** P1  
**Tags:** backend, simulation, economy, tests

## Rationale
Device wear and maintenance economics are defined in [SEC §6.2 Device Quality vs. Condition](../SEC.md#62-device-quality-vs-condition-shall--option-a-adopted) and the per-hour maintenance pricing rules in [SEC §10 Economy Integration](../SEC.md#10-economy-integration-non-intrusive). Price maps supply maintenance curve parameters per [SEC §3.6](../SEC.md#5-data-contracts-from-dd--data) and [TDD §8 Economy & Tariffs](../TDD.md#8-economy--tariffs-sec-36). We must model degradation curves, maintenance scheduling, replacements, and cost coupling consistent with these contracts.

## Scope
- Include: implement deterministic degradation curves (`m_degrade`, `m_maint`), maintenance window planning, replacement suggestions, and cost accrual tied to price maps.
- Include: telemetry/read-model outputs reflecting device condition, scheduled maintenance, and replacement advice.
- Include: long-run simulation validating degradation behaviour and maintenance costs.
- Out of scope: new device types or price map structures beyond SEC definitions; UI scheduling workflows.

## Deliverables
- Degradation engine updating `condition01` per tick with configurable curves and RNG-free behaviour.
- Maintenance planner producing tasks/windows based on condition thresholds and service intervals with deterministic scheduling.
- Replacement suggestion logic comparing maintenance vs replacement cost using price map data.
- Long-run (e.g., 120-day) integration test verifying condition decay, maintenance events, and cost accrual totals.
- Documentation/CHANGELOG updates summarising the flows.

## Implementation Steps
1. Implement degradation curve helpers using SEC-defined functions (`m_degrade`, `m_maint`) and integrate them into device tick updates.
2. Build maintenance planner that schedules tasks when condition thresholds reached or service hours elapsed, using task catalog entries.
3. Add replacement evaluation comparing cumulative maintenance cost vs device CapEx; emit recommendations via telemetry/read-model.
4. Ensure economy accrual consumes maintenance costs per hour from price maps and records in daily rollups.
5. Write long-run integration tests simulating device wear to validate condition, maintenance tasks, and accrued costs; document results.

## Acceptance Criteria / DoD
- Condition decays deterministically according to curve configuration; tests validate expected values at milestones.
- Maintenance tasks scheduled deterministically and respect workshop purpose policies (SEC §1.1 room/workshop) with telemetry emitted.
- Replacement suggestions triggered when maintenance cost exceeds replacement threshold and recorded in read-models.
- Long-run integration test asserts maintenance cost totals align with price map data and conditions remain within [0,1].
- Documentation/CHANGELOG updated accordingly.

## Tests
- Unit tests: degradation curve functions, maintenance planner logic, replacement heuristics.
- Integration tests: `packages/engine/tests/integration/pipeline/deviceMaintenance.integration.test.ts` running >120 days verifying condition/maintenance/cost outputs.
- CI/perf: ensure long-run test stays within perf budget; optionally run in nightly CI.

## Affected Files (indicative)
- `packages/engine/src/backend/src/devices/degradation.ts`
- `packages/engine/src/backend/src/workforce/maintenancePlanner.ts`
- `packages/engine/tests/unit/devices/degradation.spec.ts`
- `packages/engine/tests/integration/pipeline/deviceMaintenance.integration.test.ts`
- `docs/SEC.md` ([§6.2](../SEC.md#62-device-quality-vs-condition-shall--option-a-adopted), [§10](../SEC.md#10-economy-integration-non-intrusive))
- `docs/TDD.md` ([§8](../TDD.md#8-economy--tariffs-sec-36))
- `docs/CHANGELOG.md`

## Risks & Mitigations
- **Risk:** Long-run test flakiness due to perf. **Mitigation:** Use deterministic seeds and minimize scenario complexity; run heavy test in nightly workflow.
- **Risk:** Maintenance tasks conflict with other workforce priorities. **Mitigation:** Integrate with existing scheduler priorities and add assertions for queue ordering.
- **Risk:** Replacement heuristics mis-fire. **Mitigation:** Parameterize thresholds and cover with targeted unit tests and scenario validations.
