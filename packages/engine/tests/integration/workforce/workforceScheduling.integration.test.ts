import { describe, expect, it } from 'vitest';

import { createDemoWorld, runStages } from '@/backend/src/engine/testHarness.js';
import type {
  Employee,
  EmployeeRole,
  SimulationWorld,
  WorkforceState,
  WorkforceTaskDefinition,
  WorkforceTaskInstance,
} from '@/backend/src/domain/world.js';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function buildRole(id: string, slug: string, skillKey: string, minSkill01: number): EmployeeRole {
  return {
    id: id as EmployeeRole['id'],
    slug,
    name: slug.replace(/(^|_)(\w)/g, (_, __, ch) => ch.toUpperCase()),
    coreSkills: [
      {
        skillKey,
        minSkill01,
      },
    ],
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
  basis?: WorkforceTaskDefinition['costModel']['basis'];
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
      basis: options.basis ?? 'perAction',
      laborMinutes: options.laborMinutes,
    },
  } satisfies WorkforceTaskDefinition;
}

function createWorldWithWorkforce(workforce: WorkforceState): SimulationWorld {
  const world = createDemoWorld() as Mutable<SimulationWorld>;
  world.simTimeHours = 12;
  (world as Mutable<SimulationWorld>).workforce = workforce;
  return world;
}

describe('applyWorkforce integration', () => {
  it('processes queued tasks by priority while respecting skill bounds', () => {
    const world = createDemoWorld() as Mutable<SimulationWorld>;
    const structureId = world.company.structures[0].id;
    const gardenerRole = buildRole(
      '00000000-0000-0000-0000-000000010001',
      'gardener',
      'gardening',
      0.4,
    );
    const definitions: WorkforceTaskDefinition[] = [
      buildDefinition({
        taskCode: 'veg_low_priority',
        description: 'Routine veg maintenance',
        requiredRoleSlug: 'gardener',
        requiredSkillKey: 'gardening',
        minSkill01: 0.4,
        priority: 30,
        laborMinutes: 480,
      }),
      buildDefinition({
        taskCode: 'veg_high_priority',
        description: 'Urgent pest inspection',
        requiredRoleSlug: 'gardener',
        requiredSkillKey: 'gardening',
        minSkill01: 0.6,
        priority: 90,
        laborMinutes: 480,
      }),
    ];

    const employee = buildEmployee({
      id: '00000000-0000-0000-0000-000000020001',
      name: 'Alex Gardener',
      roleId: gardenerRole.id,
      structureId,
      morale01: 0.85,
      fatigue01: 0.2,
      skillKey: 'gardening',
      skillLevel01: 0.75,
      hoursPerDay: 8,
      overtimeHoursPerDay: 0,
    });

    const queue: WorkforceTaskInstance[] = [
      {
        id: '00000000-0000-0000-0000-000000030001' as WorkforceTaskInstance['id'],
        taskCode: 'veg_low_priority',
        status: 'queued',
        createdAtTick: 5,
        context: {
          structureId,
        },
      },
      {
        id: '00000000-0000-0000-0000-000000030002' as WorkforceTaskInstance['id'],
        taskCode: 'veg_high_priority',
        status: 'queued',
        createdAtTick: 4,
        context: {
          structureId,
        },
      },
    ];

    const workforce: WorkforceState = {
      roles: [gardenerRole],
      employees: [employee],
      taskDefinitions: definitions,
      taskQueue: queue,
      kpis: [],
      warnings: [],
      payroll: {
        dayIndex: 0,
        totals: {
          baseMinutes: 0,
          otMinutes: 0,
          baseCost: 0,
          otCost: 0,
          totalLaborCost: 0,
        },
        byStructure: [],
      },
      market: { structures: [] },
    };

    const worldWithWorkforce = createWorldWithWorkforce(workforce);
    const ctx = {};

    const nextWorld = runStages(worldWithWorkforce, ctx, ['applyWorkforce']);
    const nextQueue = nextWorld.workforce.taskQueue;

    const highPriorityTask = nextQueue.find((task) => task.taskCode === 'veg_high_priority');
    const lowPriorityTask = nextQueue.find((task) => task.taskCode === 'veg_low_priority');

    expect(highPriorityTask?.status).toBe('completed');
    expect(lowPriorityTask?.status).toBe('queued');
    expect(nextWorld.workforce.kpis.at(-1)?.queueDepth).toBe(1);
  });

  it('distributes ties deterministically based on availability and rotation', () => {
    const world = createDemoWorld() as Mutable<SimulationWorld>;
    const structureId = world.company.structures[0].id;
    const gardenerRole = buildRole(
      '00000000-0000-0000-0000-000000010002',
      'gardener',
      'gardening',
      0.4,
    );
    const definition = buildDefinition({
      taskCode: 'veg_cycle',
      description: 'Cycle tasks',
      requiredRoleSlug: 'gardener',
      requiredSkillKey: 'gardening',
      minSkill01: 0.4,
      priority: 50,
      laborMinutes: 60,
    });

    const employees: Employee[] = [
      buildEmployee({
        id: '00000000-0000-0000-0000-000000020002',
        name: 'Casey 1',
        roleId: gardenerRole.id,
        structureId,
        morale01: 0.8,
        fatigue01: 0.2,
        skillKey: 'gardening',
        skillLevel01: 0.65,
        hoursPerDay: 8,
        overtimeHoursPerDay: 0,
      }),
      buildEmployee({
        id: '00000000-0000-0000-0000-000000020003',
        name: 'Casey 2',
        roleId: gardenerRole.id,
        structureId,
        morale01: 0.8,
        fatigue01: 0.2,
        skillKey: 'gardening',
        skillLevel01: 0.65,
        hoursPerDay: 8,
        overtimeHoursPerDay: 0,
      }),
    ];

    const queue: WorkforceTaskInstance[] = [
      {
        id: '00000000-0000-0000-0000-000000030010' as WorkforceTaskInstance['id'],
        taskCode: 'veg_cycle',
        status: 'queued',
        createdAtTick: 3,
        context: { structureId },
      },
      {
        id: '00000000-0000-0000-0000-000000030011' as WorkforceTaskInstance['id'],
        taskCode: 'veg_cycle',
        status: 'queued',
        createdAtTick: 2,
        context: { structureId },
      },
    ];

    const workforce: WorkforceState = {
      roles: [gardenerRole],
      employees,
      taskDefinitions: [definition],
      taskQueue: queue,
      kpis: [],
      warnings: [],
      payroll: {
        dayIndex: 0,
        totals: {
          baseMinutes: 0,
          otMinutes: 0,
          baseCost: 0,
          otCost: 0,
          totalLaborCost: 0,
        },
        byStructure: [],
      },
      market: { structures: [] },
    };

    const worldWithWorkforce = createWorldWithWorkforce(workforce);
    const ctx = {};

    const nextWorld = runStages(worldWithWorkforce, ctx, ['applyWorkforce']);
    const assignments = nextWorld.workforce.taskQueue.filter((task) => task.status === 'completed');
    const assignedEmployees = assignments.map((task) => task.assignedEmployeeId);

    expect(new Set(assignedEmployees).size).toBe(2);
  });

  it('applies overtime morale penalties and breakroom fatigue recovery', () => {
    const world = createDemoWorld() as Mutable<SimulationWorld>;
    const structureId = world.company.structures[0].id;
    const technicianRole = buildRole(
      '00000000-0000-0000-0000-000000010010',
      'technician',
      'maintenance',
      0.5,
    );
    const gardenerRole = buildRole(
      '00000000-0000-0000-0000-000000010011',
      'gardener',
      'gardening',
      0.4,
    );

    const maintenanceDefinition = buildDefinition({
      taskCode: 'maintenance_overrun',
      description: 'Critical maintenance requiring overtime',
      requiredRoleSlug: 'technician',
      requiredSkillKey: 'maintenance',
      minSkill01: 0.6,
      priority: 90,
      laborMinutes: 360,
    });

    const breakroomDefinition = buildDefinition({
      taskCode: 'breakroom_rest',
      description: 'Scheduled break',
      requiredRoleSlug: 'gardener',
      requiredSkillKey: 'gardening',
      minSkill01: 0.5,
      priority: 40,
      laborMinutes: 60,
    });

    const technician = buildEmployee({
      id: '00000000-0000-0000-0000-000000020020',
      name: 'Morgan Tech',
      roleId: technicianRole.id,
      structureId,
      morale01: 0.9,
      fatigue01: 0.2,
      skillKey: 'maintenance',
      skillLevel01: 0.8,
      hoursPerDay: 5,
      overtimeHoursPerDay: 2,
    });

    const gardener = buildEmployee({
      id: '00000000-0000-0000-0000-000000020021',
      name: 'Jamie Gardener',
      roleId: gardenerRole.id,
      structureId,
      morale01: 0.7,
      fatigue01: 0.5,
      skillKey: 'gardening',
      skillLevel01: 0.7,
      hoursPerDay: 6,
      overtimeHoursPerDay: 1,
    });

    const queue: WorkforceTaskInstance[] = [
      {
        id: '00000000-0000-0000-0000-000000030020' as WorkforceTaskInstance['id'],
        taskCode: 'breakroom_rest',
        status: 'queued',
        createdAtTick: 8,
        context: {
          structureId,
          roomPurpose: 'breakroom',
        },
      },
      {
        id: '00000000-0000-0000-0000-000000030021' as WorkforceTaskInstance['id'],
        taskCode: 'maintenance_overrun',
        status: 'queued',
        createdAtTick: 7,
        context: {
          structureId,
        },
      },
    ];

    const workforce: WorkforceState = {
      roles: [technicianRole, gardenerRole],
      employees: [technician, gardener],
      taskDefinitions: [maintenanceDefinition, breakroomDefinition],
      taskQueue: queue,
      kpis: [],
      warnings: [],
      payroll: {
        dayIndex: 0,
        totals: {
          baseMinutes: 0,
          otMinutes: 0,
          baseCost: 0,
          otCost: 0,
          totalLaborCost: 0,
        },
        byStructure: [],
      },
      market: { structures: [] },
    };

    const worldWithWorkforce = createWorldWithWorkforce(workforce);
    const ctx = {};

    const nextWorld = runStages(worldWithWorkforce, ctx, ['applyWorkforce']);
    const nextEmployees = nextWorld.workforce.employees;
    const updatedTechnician = nextEmployees.find((emp) => emp.id === technician.id);
    const updatedGardener = nextEmployees.find((emp) => emp.id === gardener.id);

    expect(updatedTechnician?.morale01).toBeCloseTo(0.88, 5);
    expect(updatedGardener?.fatigue01).toBeLessThan(gardener.fatigue01);
    expect(nextWorld.workforce.kpis.at(-1)?.overtimeMinutes).toBe(60);
  });

  it('handles termination intents with morale ripple and telemetry emission', () => {
    const world = createDemoWorld() as Mutable<SimulationWorld>;
    const structureId = world.company.structures[0].id;

    const gardenerRole = buildRole(
      '00000000-0000-0000-0000-000000010201',
      'gardener',
      'gardening',
      0.4,
    );
    const janitorRole = buildRole(
      '00000000-0000-0000-0000-000000010202',
      'janitor',
      'cleanliness',
      0.3,
    );

    const gardener = buildEmployee({
      id: '00000000-0000-0000-0000-000000020201',
      name: 'Avery Gardener',
      roleId: gardenerRole.id,
      structureId,
      morale01: 0.65,
      fatigue01: 0.1,
      skillKey: 'gardening',
      skillLevel01: 0.7,
      hoursPerDay: 8,
      overtimeHoursPerDay: 1,
    });

    const janitor = buildEmployee({
      id: '00000000-0000-0000-0000-000000020202',
      name: 'Jamie Janitor',
      roleId: janitorRole.id,
      structureId,
      morale01: 0.6,
      fatigue01: 0.1,
      skillKey: 'cleanliness',
      skillLevel01: 0.55,
      hoursPerDay: 8,
      overtimeHoursPerDay: 0,
    });

    const cleaningTask = buildDefinition({
      taskCode: 'daily_cleaning',
      description: 'Routine cleaning shift',
      requiredRoleSlug: 'janitor',
      requiredSkillKey: 'cleanliness',
      minSkill01: 0.5,
      priority: 40,
      laborMinutes: 180,
    });

    const task: WorkforceTaskInstance = {
      id: '00000000-0000-0000-0000-000000030201' as WorkforceTaskInstance['id'],
      taskCode: 'daily_cleaning',
      status: 'queued',
      createdAtTick: 5,
      context: { structureId },
      assignedEmployeeId: janitor.id,
    } satisfies WorkforceTaskInstance;

    const workforce: WorkforceState = {
      roles: [gardenerRole, janitorRole],
      employees: [gardener, janitor],
      taskDefinitions: [cleaningTask],
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

    const telemetryEvents: { topic: string; payload: any }[] = [];
    const ctx: EngineRunContext = {
      telemetry: {
        emit: (topic: string, payload: any) => {
          telemetryEvents.push({ topic, payload });
        },
      },
      workforceIntents: [
        {
          type: 'workforce.employee.terminate',
          employeeId: janitor.id,
          moraleRipple01: -0.05,
          reasonSlug: 'restructure',
          severanceCc: 2000,
        },
      ],
    } satisfies EngineRunContext;

    const nextWorld = runStages(
      createWorldWithWorkforce(workforce),
      ctx,
      ['applyWorkforce'],
    );

    const remainingEmployees = nextWorld.workforce.employees;
    expect(remainingEmployees).toHaveLength(1);
    expect(remainingEmployees[0]?.id).toBe(gardener.id);
    expect(remainingEmployees[0]?.morale01).toBeCloseTo(0.6, 5);

    const nextQueue = nextWorld.workforce.taskQueue;
    expect(nextQueue[0]?.assignedEmployeeId).toBeUndefined();
    expect(nextQueue[0]?.status).toBe('queued');

    const terminationEvent = telemetryEvents.find(
      (entry) => entry.topic === 'telemetry.workforce.employee.terminated.v1',
    );
    expect(terminationEvent).toBeDefined();
    expect(terminationEvent?.payload.event.employeeId).toBe(janitor.id);
    expect(
      telemetryEvents.some((entry) => entry.topic === 'telemetry.workforce.payroll_snapshot.v1'),
    ).toBe(true);
  });
});
