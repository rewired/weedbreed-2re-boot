ID: 0010
# Cultivation Method Tasks Runtime

**ID:** 0009  
**Status:** Planned  
**Owner:** unassigned  
**Priority:** P1  
**Tags:** backend, cultivation, tasks, tests

## Rationale
SEC requires every zone to reference a cultivation method with containers, substrates, reuse policies, and associated tasks ([SEC §7.5](../SEC.md#423-zone-requirement-shall); [AGENTS §5.1](../../AGENTS.md#51-cultivation-methods-are-required-on-zones-sec-75)). Tasks such as repotting, sterilization, disposal, and reuse policy enforcement must emit deterministically and accrue costs ([SEC §3.3](../SEC.md#33-task--treatment-catalogs-data-driven); [SEC §10](../SEC.md#10-economy-integration-non-intrusive)). We need runtime logic that translates cultivation method policies into scheduled tasks.

## Scope
- Include: derive runtime tasks (repot, sterilize, dispose, reuse) from cultivation method metadata and schedule them deterministically.
- Include: integrate with workforce scheduler and economy accrual for labor/material costs.
- Include: acceptance scenario verifying tasks emit per schedule (e.g., service life cycles, reuse limits).
- Out of scope: new cultivation method schemas beyond SEC definitions; UI interactions.

## Deliverables
- Runtime module that reads cultivation method policies and produces task schedules (including recurrence, prerequisites) for each zone.
- Workforce/economy integration ensuring tasks enter queues with correct codes, required roles/skills, and associated costs.
- Integration test verifying tasks emit according to method schedules over a multi-cycle simulation, including reuse policy resets.
- Documentation/CHANGELOG updates summarising the runtime behaviour.

## Implementation Steps
1. Parse cultivation method blueprint metadata (containers, substrates, reuse policy, service life) into runtime descriptors.
2. Implement scheduler that monitors plant lifecycle/usage counts to trigger tasks (repotting, sterilization, disposal) at deterministic intervals.
3. Hook into workforce task queue to enqueue tasks with catalog codes and into economy accrual for associated costs.
4. Add integration test covering multiple cycles verifying expected task emission counts and sequencing; include reuse policy enforcement.
5. Update documentation (SEC clarifications if needed, TDD) and CHANGELOG.

## Acceptance Criteria / DoD
- For a given cultivation method, runtime produces deterministic task emission schedule (counts and timing) across runs.
- Tasks carry correct catalog codes, role/skill requirements, and costs; reuse policies enforce sterilization before reuse beyond allowed cycles.
- Integration test demonstrates scenario where repot/sterilize/disposal tasks emit at documented intervals; assertions compare against expected counts.
- Documentation/CHANGELOG updated to reflect runtime behaviour.

## Tests
- Unit tests: cultivation method parser (ensuring required fields) and task schedule calculator.
- Integration test: `packages/engine/tests/integration/pipeline/cultivationMethodTasks.integration.test.ts` running multiple growth cycles verifying task emissions and economy impacts.
- CI: ensure new tests run via pnpm suite; optionally include counts check in golden master summary.

## Affected Files (indicative)
- `packages/engine/src/backend/src/cultivation/methodRuntime.ts`
- `packages/engine/src/backend/src/workforce/taskScheduler.ts`
- `packages/engine/tests/unit/cultivation/methodRuntime.spec.ts`
- `packages/engine/tests/integration/pipeline/cultivationMethodTasks.integration.test.ts`
- `docs/SEC.md` ([§7.5](../SEC.md#423-zone-requirement-shall), [§3.3](../SEC.md#33-task--treatment-catalogs-data-driven), [§10](../SEC.md#10-economy-integration-non-intrusive))
- `AGENTS.md` ([§5.1](../../AGENTS.md#51-cultivation-methods-are-required-on-zones-sec-75))
- `docs/CHANGELOG.md`

## Risks & Mitigations
- **Risk:** Task spam due to misconfigured recurrence. **Mitigation:** Validate schedules against service life/reuse data and add assertions for maximum concurrency.
- **Risk:** Economy coupling duplicates costs. **Mitigation:** Centralize cost calculation in economy accrual and test aggregated totals.
- **Risk:** Scheduler conflicts with other workforce tasks. **Mitigation:** Prioritize cultivation maintenance appropriately and include integration tests for queue order.
