import { describe, expect, it } from 'vitest';

import { createDemoWorld, runStages } from '@/backend/src/engine/testHarness.js';
import { getWorkforceRuntime } from '@/backend/src/engine/pipeline/applyWorkforce.js';
import type { WorkforceAssignment } from '@/backend/src/engine/pipeline/applyWorkforce.js';
import type { EngineRunContext } from '@/backend/src/engine/Engine.js';
import type {
  Employee,
  EmployeeRole,
  SimulationWorld,
  WorkforceState,
  WorkforceTaskDefinition,
  WorkforceTaskInstance,
} from '@/backend/src/domain/world.js';

function buildRole(id: string, slug: string): EmployeeRole {
  return {
    id: id as EmployeeRole['id'],
    slug,
    name: slug,
    coreSkills: [{ skillKey: 'gardening', minSkill01: 0.4 }],
  } satisfies EmployeeRole;
}

function buildEmployee(id: string, roleId: string, traits: Employee['traits']): Employee {
  return {
    id: id as Employee['id'],
    name: `Employee-${id.slice(-4)}`,
    roleId,
    rngSeedUuid: '018f43f1-8b44-7b74-b3ce-5fbd7be3c201',
    assignedStructureId: '00000000-0000-0000-0000-000000000123' as Employee['assignedStructureId'],
    morale01: 0.7,
    fatigue01: 0.1,
    skills: [{ skillKey: 'gardening', level01: 0.6 }],
    skillTriad: {
      main: { skillKey: 'gardening', level01: 0.6 },
      secondary: [
        { skillKey: 'maintenance', level01: 0.4 },
        { skillKey: 'cleanliness', level01: 0.3 },
      ],
    },
    traits,
    schedule: {
      hoursPerDay: 8,
      overtimeHoursPerDay: 0,
      daysPerWeek: 5,
      shiftStartHour: 8,
    },
    baseRateMultiplier: 1,
    experience: { hoursAccrued: 0, level01: 0 },
    laborMarketFactor: 1,
    timePremiumMultiplier: 1,
    employmentStartDay: 0,
    salaryExpectation_per_h: 5 + 10 * 0.6,
    raise: { cadenceSequence: 0, nextEligibleDay: 180 },
  } satisfies Employee;
}

function buildTask(): WorkforceTaskDefinition {
  return {
    taskCode: 'long_shift',
    description: 'Long gardening shift',
    requiredRoleSlug: 'gardener',
    requiredSkills: [{ skillKey: 'gardening', minSkill01: 0.4 }],
    priority: 50,
    costModel: { basis: 'perAction', laborMinutes: 240 },
  } satisfies WorkforceTaskDefinition;
}

describe('workforce trait effects integration', () => {
  it('records trait-adjusted assignment metadata', () => {
    const world = createDemoWorld() as SimulationWorld;
    const role = buildRole('00000000-0000-0000-0000-00000000aaaa', 'gardener');
    const taskDefinition = buildTask();
    const task: WorkforceTaskInstance = {
      id: '00000000-0000-0000-0000-00000000bbbb' as WorkforceTaskInstance['id'],
      taskCode: taskDefinition.taskCode,
      status: 'queued',
      createdAtTick: world.simTimeHours,
      context: { structureId: '00000000-0000-0000-0000-000000000123' },
    } satisfies WorkforceTaskInstance;

    const workforce: WorkforceState = {
      roles: [role],
      employees: [
        buildEmployee('00000000-0000-0000-0000-00000000c001', role.id, [
          { traitId: 'trait_slacker', strength01: 0.6 },
        ]),
      ],
      taskDefinitions: [taskDefinition],
      taskQueue: [task],
      kpis: [],
      warnings: [],
      payroll: {
        dayIndex: 0,
        totals: { baseMinutes: 0, otMinutes: 0, baseCost: 0, otCost: 0, totalLaborCost: 0 },
        byStructure: [],
      },
      market: { structures: [] },
    } satisfies WorkforceState;

    let firstAssignments: readonly WorkforceAssignment[] = [];
    const ctx: EngineRunContext = {
      instrumentation: {
        onStageComplete(step) {
          if (step === 'applyWorkforce') {
            firstAssignments = getWorkforceRuntime(ctx)?.assignments ?? [];
          }
        },
      },
    };

    const nextWorld = runStages(
      { ...world, workforce } satisfies SimulationWorld,
      ctx,
      ['applyWorkforce'],
    );

    expect(firstAssignments).toHaveLength(1);
    const [assignment] = firstAssignments;
    expect(assignment.taskEffects.durationMinutes).toBeGreaterThan(240);
    expect(assignment.taskEffects.xpRateMultiplier).toBeLessThan(1);
    expect(assignment.wellbeingEffects.fatigueDelta).toBeGreaterThan(0);

    let productiveAssignments: readonly WorkforceAssignment[] = [];
    const refreshedCtx: EngineRunContext = {
      instrumentation: {
        onStageComplete(step) {
          if (step === 'applyWorkforce') {
            productiveAssignments = getWorkforceRuntime(refreshedCtx)?.assignments ?? [];
          }
        },
      },
    };
    const productiveEmployee = buildEmployee('00000000-0000-0000-0000-00000000c002', role.id, [
      { traitId: 'trait_green_thumb', strength01: 0.7 },
    ]);

    const followupTask: WorkforceTaskInstance = {
      id: '00000000-0000-0000-0000-00000000c003' as WorkforceTaskInstance['id'],
      taskCode: taskDefinition.taskCode,
      status: 'queued',
      createdAtTick: nextWorld.simTimeHours,
      context: { structureId: '00000000-0000-0000-0000-000000000123' },
    } satisfies WorkforceTaskInstance;

    runStages(
      {
        ...world,
        simTimeHours: nextWorld.simTimeHours + 1,
        workforce: {
          ...workforce,
          employees: [productiveEmployee],
          taskQueue: [followupTask],
        },
      } satisfies SimulationWorld,
      refreshedCtx,
      ['applyWorkforce'],
    );

    expect(productiveAssignments).toHaveLength(1);
    const [productiveAssignment] = productiveAssignments;
    expect(productiveAssignment.taskEffects.durationMinutes).toBeLessThan(240);
    expect(productiveAssignment.taskEffects.errorRate01).toBeLessThanOrEqual(
      assignment.taskEffects.errorRate01,
    );
    expect(productiveAssignment.taskEffects.deviceWearMultiplier).toBeLessThanOrEqual(
      assignment.taskEffects.deviceWearMultiplier,
    );
  });
});
