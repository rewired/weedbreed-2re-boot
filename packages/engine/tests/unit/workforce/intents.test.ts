import { describe, expect, it } from 'vitest';

import { applyWorkforce, queueWorkforceIntents } from '@/backend/src/engine/pipeline/applyWorkforce';
import type { EngineRunContext } from '@/backend/src/engine/Engine';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import type {
  Employee,
  EmployeeRole,
  Structure,
  WorkforceState,
  WorkforceTaskDefinition,
  WorkforceTaskInstance,
  Zone,
} from '@/backend/src/domain/world';

function createRole(id: string, slug: string): EmployeeRole {
  return {
    id: id as EmployeeRole['id'],
    slug,
    name: slug,
    coreSkills: [],
  } satisfies EmployeeRole;
}

function createEmployee(options: {
  id: string;
  name: string;
  roleId: EmployeeRole['id'];
  structureId: Structure['id'];
}): Employee {
  return {
    id: options.id as Employee['id'],
    name: options.name,
    roleId: options.roleId,
    rngSeedUuid: '018f43f1-8b44-7b74-b3ce-5fbd7be3c201',
    assignedStructureId: options.structureId,
    morale01: 0.75,
    fatigue01: 0.1,
    skills: [],
    traits: [],
    schedule: { hoursPerDay: 8, overtimeHoursPerDay: 0, daysPerWeek: 5, shiftStartHour: 6 },
    baseRateMultiplier: 1,
    experience: { hoursAccrued: 0, level01: 0 },
    laborMarketFactor: 1,
    timePremiumMultiplier: 1,
    employmentStartDay: 0,
    salaryExpectation_per_h: 10,
    raise: { cadenceSequence: 0, nextEligibleDay: 180 },
  } satisfies Employee;
}

function createTaskDefinition(taskCode: string, roleSlug: string): WorkforceTaskDefinition {
  return {
    taskCode,
    description: taskCode,
    requiredRoleSlug: roleSlug,
    requiredSkills: [],
    priority: 50,
    costModel: { basis: 'perAction', laborMinutes: 60 },
  } satisfies WorkforceTaskDefinition;
}

function createInspectionTask(zoneId: Zone['id']): WorkforceTaskInstance {
  return {
    id: `task-${zoneId}` as WorkforceTaskInstance['id'],
    taskCode: 'task.pest.inspection',
    status: 'queued',
    createdAtTick: 0,
    dueTick: 4,
    context: { zoneId },
  } satisfies WorkforceTaskInstance;
}

describe('workforce intent handlers', () => {
  it('reassigns an employee to the target structure via hr.assign', () => {
    const ctx: EngineRunContext = {};
    const world = createDemoWorld();
    const baseStructure = world.company.structures[0];
    const secondStructure: Structure = {
      ...baseStructure,
      id: '00000000-0000-4000-8000-000000000102' as Structure['id'],
      slug: 'second-structure',
      name: 'Second Structure',
      rooms: baseStructure.rooms.map((room, index) => ({
        ...room,
        id: (`00000000-0000-4000-8000-000000000${120 + index}`) as typeof room.id,
        zones: room.zones.map((zone, zoneIndex) => ({
          ...zone,
          id: (`00000000-0000-4000-8000-000000000${130 + zoneIndex}`) as typeof zone.id,
        })),
      })),
    } satisfies Structure;
    world.company.structures = [baseStructure, secondStructure];

    const role = createRole('00000000-0000-0000-0000-000000000111', 'gardener');
    const workforce: WorkforceState = {
      roles: [role],
      employees: [
        createEmployee({
          id: '00000000-0000-0000-0000-000000000201',
          name: 'Casey Gardner',
          roleId: role.id,
          structureId: baseStructure.id,
        }),
      ],
      taskDefinitions: [],
      taskQueue: [],
      kpis: [],
      warnings: [],
      payroll: world.workforce.payroll,
      market: world.workforce.market,
    } satisfies WorkforceState;
    world.workforce = workforce;

    const targetZoneId = secondStructure.rooms[0]?.zones[0]?.id;
    if (!targetZoneId) {
      throw new Error('Second structure is missing a zone for assignment test.');
    }

    queueWorkforceIntents(ctx, [
      { type: 'hr.assign', employeeId: workforce.employees[0].id, targetId: targetZoneId },
    ]);

    const result = applyWorkforce(world, ctx);
    const reassigned = result.workforce.employees[0];
    expect(reassigned?.assignedStructureId).toBe(secondStructure.id);
    expect(result.workforce.warnings.some((warning) => warning.code.startsWith('workforce.hr.'))).toBe(false);
  });

  it('emits a warning when pest inspection starts without available capacity', () => {
    const ctx: EngineRunContext = {};
    const world = createDemoWorld();
    world.simTimeHours = 1;
    const zone = world.company.structures[0]?.rooms[0]?.zones[0];
    if (!zone) {
      throw new Error('Demo world missing expected zone for pest test.');
    }

    const role = createRole('00000000-0000-0000-0000-000000000311', 'gardener');
    const workforce: WorkforceState = {
      roles: [role],
      employees: [],
      taskDefinitions: [createTaskDefinition('task.pest.inspection', 'gardener')],
      taskQueue: [createInspectionTask(zone.id)],
      kpis: [],
      warnings: [],
      payroll: world.workforce.payroll,
      market: world.workforce.market,
    } satisfies WorkforceState;
    world.workforce = workforce;

    queueWorkforceIntents(ctx, [{ type: 'pest.inspect.start', zoneId: zone.id }]);
    const result = applyWorkforce(world, ctx);

    expect(result.workforce.taskQueue[0]?.status).toBe('queued');
    const warningCodes = result.workforce.warnings.map((warning) => warning.code);
    expect(warningCodes).toContain('workforce.pest.capacity_overflow');
  });

  it('marks pest inspection tasks in progress and completion through intents', () => {
    const ctx: EngineRunContext = {};
    let world = createDemoWorld();
    world.simTimeHours = 2;
    const zone = world.company.structures[0]?.rooms[0]?.zones[0];
    if (!zone) {
      throw new Error('Demo world missing expected zone for pest scheduling test.');
    }

    const role = createRole('00000000-0000-0000-0000-000000000411', 'gardener');
    const employee = createEmployee({
      id: '00000000-0000-0000-0000-000000000501',
      name: 'Morgan Peston',
      roleId: role.id,
      structureId: world.company.structures[0].id,
    });

    const workforce: WorkforceState = {
      roles: [role],
      employees: [employee],
      taskDefinitions: [createTaskDefinition('task.pest.inspection', 'gardener')],
      taskQueue: [createInspectionTask(zone.id)],
      kpis: [],
      warnings: [],
      payroll: world.workforce.payroll,
      market: world.workforce.market,
    } satisfies WorkforceState;
    world.workforce = workforce;

    queueWorkforceIntents(ctx, [{ type: 'pest.inspect.start', zoneId: zone.id }]);
    world = applyWorkforce(world, ctx);
    expect(world.workforce.taskQueue[0]?.status).toBe('in-progress');

    queueWorkforceIntents(ctx, [{ type: 'pest.inspect.complete', zoneId: zone.id }]);
    world = applyWorkforce(world, ctx);
    expect(world.workforce.taskQueue[0]?.status).toBe('completed');
  });
});
