import { describe, expect, it } from 'vitest';

import { createDemoWorld, runStages } from '@/backend/src/engine/testHarness.js';
import type { EngineRunContext } from '@/backend/src/engine/Engine.js';
import type {
  Employee,
  EmployeeRole,
  SimulationWorld,
  WorkforceState,
  WorkforceTaskDefinition,
  WorkforceTaskInstance,
  WorkforcePayrollState,
} from '@/backend/src/domain/world.js';

function buildRole(
  id: string,
  slug: string,
  skillKey: string,
  minSkill01: number,
  baseRateMultiplier = 1,
): EmployeeRole {
  return {
    id: id as EmployeeRole['id'],
    slug,
    name: slug,
    coreSkills: [
      {
        skillKey,
        minSkill01,
      },
    ],
    baseRateMultiplier,
  } satisfies EmployeeRole;
}

function buildEmployee(options: {
  id: string;
  name: string;
  roleId: EmployeeRole['id'];
  structureId: string;
  morale01: number;
  fatigue01: number;
  skillKey: string;
  skillLevel01: number;
  hoursPerDay: number;
  overtimeHoursPerDay: number;
}): Employee {
  return {
    id: options.id as Employee['id'],
    name: options.name,
    roleId: options.roleId,
    rngSeedUuid: '018f43f1-8b44-7b74-b3ce-5fbd7be3c201',
    assignedStructureId: options.structureId as Employee['assignedStructureId'],
    morale01: options.morale01,
    fatigue01: options.fatigue01,
    skills: [
      {
        skillKey: options.skillKey,
        level01: options.skillLevel01,
      },
    ],
    skillTriad: {
      main: { skillKey: options.skillKey, level01: options.skillLevel01 },
      secondary: [
        { skillKey: options.skillKey, level01: options.skillLevel01 },
        { skillKey: options.skillKey, level01: options.skillLevel01 },
      ],
    },
    traits: [],
    schedule: {
      hoursPerDay: options.hoursPerDay,
      overtimeHoursPerDay: options.overtimeHoursPerDay,
      daysPerWeek: 5,
      shiftStartHour: 6,
    },
    baseRateMultiplier: 1,
    experience: { hoursAccrued: 0, level01: 0 },
    laborMarketFactor: 1,
    timePremiumMultiplier: 1,
    employmentStartDay: 0,
    salaryExpectation_per_h: 5 + 10 * options.skillLevel01,
    raise: { cadenceSequence: 0, nextEligibleDay: 180 },
  } satisfies Employee;
}

function buildDefinition(options: {
  taskCode: string;
  description: string;
  requiredRoleSlug: string;
  requiredSkillKey: string;
  minSkill01: number;
  priority: number;
  laborMinutes: number;
}): WorkforceTaskDefinition {
  return {
    taskCode: options.taskCode,
    description: options.description,
    requiredRoleSlug: options.requiredRoleSlug,
    requiredSkills: [
      {
        skillKey: options.requiredSkillKey,
        minSkill01: options.minSkill01,
      },
    ],
    priority: options.priority,
    costModel: {
      basis: 'perAction',
      laborMinutes: options.laborMinutes,
    },
  } satisfies WorkforceTaskDefinition;
}

function createPayrollState(dayIndex: number): WorkforcePayrollState {
  return {
    dayIndex,
    totals: {
      baseMinutes: 0,
      otMinutes: 0,
      baseCost: 0,
      otCost: 0,
      totalLaborCost: 0,
    },
    byStructure: [],
  } satisfies WorkforcePayrollState;
}

describe('workforce payroll accruals', () => {
  it('accrues base and overtime minutes with location index scaling', () => {
    const world = createDemoWorld() as SimulationWorld;
    const structureId = world.company.structures[0].id;
    world.simTimeHours = 10;

    const gardenerRole = buildRole(
      '00000000-0000-0000-0000-000000010050',
      'gardener',
      'gardening',
      0.5,
    );

    const employee = buildEmployee({
      id: '00000000-0000-0000-0000-000000020050',
      name: 'Taylor Gardener',
      roleId: gardenerRole.id,
      structureId,
      morale01: 0.9,
      fatigue01: 0.1,
      skillKey: 'gardening',
      skillLevel01: 0.8,
      hoursPerDay: 8,
      overtimeHoursPerDay: 2,
    });

    const taskDefinition = buildDefinition({
      taskCode: 'long_run',
      description: 'Extended maintenance shift',
      requiredRoleSlug: 'gardener',
      requiredSkillKey: 'gardening',
      minSkill01: 0.5,
      priority: 90,
      laborMinutes: 540,
    });

    const task: WorkforceTaskInstance = {
      id: '00000000-0000-0000-0000-000000030050' as WorkforceTaskInstance['id'],
      taskCode: 'long_run',
      status: 'queued',
      createdAtTick: 6,
      context: { structureId },
    };

    const workforce: WorkforceState = {
      roles: [gardenerRole],
      employees: [employee],
      taskDefinitions: [taskDefinition],
      taskQueue: [task],
      kpis: [],
      warnings: [],
      payroll: createPayrollState(0),
      market: { structures: [] },
    } satisfies WorkforceState;

    const ctx: EngineRunContext = {
      payroll: {
        locationIndexTable: {
          defaultIndex: 1.2,
          overrides: [],
        },
      },
    };

    const nextWorld = runStages(
      { ...world, workforce } satisfies SimulationWorld,
      ctx,
      ['applyWorkforce', 'applyEconomyAccrual'],
    );

    const totals = nextWorld.workforce.payroll.totals;

    expect(totals.baseMinutes).toBe(480);
    expect(totals.otMinutes).toBe(60);
    expect(totals.baseCost).toBeCloseTo(124.8, 4);
    expect(totals.otCost).toBeCloseTo(19.5, 4);
    expect(totals.totalLaborCost).toBeCloseTo(144.3, 4);

    const economyState = (ctx as { economyAccruals?: any }).economyAccruals;
    expect(economyState?.workforce?.current?.totals.totalLaborCost).toBeCloseTo(144.3, 4);
  });

  it('applies city-level location index overrides when available', () => {
    const world = createDemoWorld() as SimulationWorld;
    const structureId = world.company.structures[0].id;
    world.simTimeHours = 8;

    const gardenerRole = buildRole(
      '00000000-0000-0000-0000-000000010051',
      'gardener',
      'gardening',
      0.4,
    );

    const employee = buildEmployee({
      id: '00000000-0000-0000-0000-000000020051',
      name: 'Jordan',
      roleId: gardenerRole.id,
      structureId,
      morale01: 0.8,
      fatigue01: 0.2,
      skillKey: 'gardening',
      skillLevel01: 0.6,
      hoursPerDay: 6,
      overtimeHoursPerDay: 0,
    });

    const taskDefinition = buildDefinition({
      taskCode: 'single_task',
      description: 'Quick pass',
      requiredRoleSlug: 'gardener',
      requiredSkillKey: 'gardening',
      minSkill01: 0.4,
      priority: 50,
      laborMinutes: 180,
    });

    const task: WorkforceTaskInstance = {
      id: '00000000-0000-0000-0000-000000030051' as WorkforceTaskInstance['id'],
      taskCode: 'single_task',
      status: 'queued',
      createdAtTick: 6,
      context: { structureId },
    };

    const workforce: WorkforceState = {
      roles: [gardenerRole],
      employees: [employee],
      taskDefinitions: [taskDefinition],
      taskQueue: [task],
      kpis: [],
      warnings: [],
      payroll: createPayrollState(0),
      market: { structures: [] },
    } satisfies WorkforceState;

    const ctx: EngineRunContext = {
      payroll: {
        locationIndexTable: {
          defaultIndex: 0.9,
          overrides: [
            { countryName: 'Germany', index: 1.05 },
            { countryName: 'Germany', cityName: 'Hamburg', index: 1.4 },
          ],
        },
      },
    };

    const nextWorld = runStages(
      { ...world, workforce } satisfies SimulationWorld,
      ctx,
      ['applyWorkforce', 'applyEconomyAccrual'],
    );

    const totals = nextWorld.workforce.payroll.totals;
    // base rate: (5 + 10 * 0.6) = 11 -> * 1.4 => 15.4 per hour.
    expect(totals.baseCost).toBeCloseTo((15.4 / 60) * 180, 4);
  });

  it('scales payroll with role, experience, labor market, and premium multipliers', () => {
    const world = createDemoWorld() as SimulationWorld;
    const structureId = world.company.structures[0].id;
    world.simTimeHours = 20;

    const specialistRole = buildRole(
      '00000000-0000-0000-0000-000000010099',
      'specialist',
      'analysis',
      0.5,
      1.2,
    );

    const employee = buildEmployee({
      id: '00000000-0000-0000-0000-000000020099',
      name: 'Morgan Specialist',
      roleId: specialistRole.id,
      structureId,
      morale01: 0.9,
      fatigue01: 0.1,
      skillKey: 'analysis',
      skillLevel01: 0.6,
      hoursPerDay: 6,
      overtimeHoursPerDay: 2,
    });

    const experiencedEmployee: Employee = {
      ...employee,
      baseRateMultiplier: 1.1,
      laborMarketFactor: 1.15,
      timePremiumMultiplier: 1.5,
      experience: { hoursAccrued: 2000, level01: 0.5 },
      employmentStartDay: 120,
      salaryExpectation_per_h: 28.18,
      raise: { cadenceSequence: 3, lastDecisionDay: 250, nextEligibleDay: 430 },
    };

    const taskDefinition = buildDefinition({
      taskCode: 'deep_dive',
      description: 'Analytical deep dive',
      requiredRoleSlug: 'specialist',
      requiredSkillKey: 'analysis',
      minSkill01: 0.5,
      priority: 95,
      laborMinutes: 180,
    });

    const task: WorkforceTaskInstance = {
      id: '00000000-0000-0000-0000-000000030099' as WorkforceTaskInstance['id'],
      taskCode: 'deep_dive',
      status: 'queued',
      createdAtTick: 12,
      context: { structureId },
    };

    const workforce: WorkforceState = {
      roles: [specialistRole],
      employees: [experiencedEmployee],
      taskDefinitions: [taskDefinition],
      taskQueue: [task],
      kpis: [],
      warnings: [],
      payroll: createPayrollState(0),
      market: { structures: [] },
    } satisfies WorkforceState;

    const ctx: EngineRunContext = {
      payroll: {
        locationIndexTable: {
          defaultIndex: 1,
          overrides: [],
        },
      },
    };

    const nextWorld = runStages(
      { ...world, workforce } satisfies SimulationWorld,
      ctx,
      ['applyWorkforce', 'applyEconomyAccrual'],
    );

    const totals = nextWorld.workforce.payroll.totals;

    expect(totals.baseMinutes).toBe(180);
    expect(totals.otMinutes).toBe(0);
    expect(totals.baseCost).toBeCloseTo(84.533625, 4);
    expect(totals.otCost).toBeCloseTo(0, 4);
    expect(totals.totalLaborCost).toBeCloseTo(84.533625, 4);
  });

  it('finalizes previous day payroll with banker rounding when day rolls over', () => {
    const world = createDemoWorld() as SimulationWorld;
    const structureId = world.company.structures[0].id;
    world.simTimeHours = 24;

    const priorPayroll: WorkforcePayrollState = {
      dayIndex: 0,
      totals: {
        baseMinutes: 30,
        otMinutes: 0,
        baseCost: 10.005,
        otCost: 0,
        totalLaborCost: 10.005,
      },
      byStructure: [
        {
          structureId,
          baseMinutes: 30,
          otMinutes: 0,
          baseCost: 10.005,
          otCost: 0,
          totalLaborCost: 10.005,
        },
      ],
    } satisfies WorkforcePayrollState;

    const workforce: WorkforceState = {
      roles: [],
      employees: [],
      taskDefinitions: [],
      taskQueue: [],
      kpis: [],
      warnings: [],
      payroll: priorPayroll,
    } satisfies WorkforceState;

    const ctx: EngineRunContext = {};

    const nextWorld = runStages(
      { ...world, workforce } satisfies SimulationWorld,
      ctx,
      ['applyWorkforce', 'applyEconomyAccrual'],
    );

    const nextPayroll = nextWorld.workforce.payroll;
    expect(nextPayroll.dayIndex).toBe(1);
    expect(nextPayroll.totals.baseMinutes).toBe(0);
    expect(nextPayroll.totals.totalLaborCost).toBe(0);

    const finalizedDays = (ctx as { economyAccruals?: any }).economyAccruals?.workforce?.finalizedDays;
    expect(finalizedDays).toBeDefined();
    expect(finalizedDays?.[0]?.totals.baseCost).toBe(10);
    expect(finalizedDays?.[0]?.totals.totalLaborCost).toBe(10);
  });
});
