import { describe, expect, it } from 'vitest';

import {
  createWorkforceView,
  type WorkforceViewOptions
} from '../../src/index.ts';
import {
  employeeSchema,
  workforceTaskInstanceSchema
} from '@/backend/src/domain/schemas/workforce.ts';
import {
  uuidSchema,
  type Employee,
  type EmployeeRole,
  type Structure,
  type WorkforceState,
  type WorkforceTaskDefinition,
  type WorkforceTaskInstance,
  type WorkforceWarning
} from '@wb/engine';

function createRole(id: string, slug: string, name: string): EmployeeRole {
  return {
    id: uuidSchema.parse(id),
    slug,
    name,
    coreSkills: [],
    description: `Role ${name}`,
    tags: []
  } satisfies EmployeeRole;
}

function createEmployee(options: {
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
  gender?: 'm' | 'f' | 'd';
  traits?: Employee['traits'];
  skillTriad?: Employee['skillTriad'];
}): Employee & { gender?: 'm' | 'f' | 'd' } {
  const base = employeeSchema.parse({
    id: uuidSchema.parse(options.id),
    name: options.name,
    roleId: options.roleId,
    rngSeedUuid: '018f43f1-8b44-7b74-b3ce-5fbd7be3c201',
    assignedStructureId: uuidSchema.parse(options.structureId),
    morale01: options.morale01,
    fatigue01: options.fatigue01,
    skills: [
      {
        skillKey: options.skillKey,
        level01: options.skillLevel01
      }
    ],
    skillTriad:
      options.skillTriad ?? {
        main: { skillKey: options.skillKey, level01: options.skillLevel01 },
        secondary: [
          { skillKey: options.skillKey, level01: options.skillLevel01 },
          { skillKey: options.skillKey, level01: options.skillLevel01 }
        ]
      },
    traits: options.traits ?? [],
    schedule: {
      hoursPerDay: options.hoursPerDay,
      overtimeHoursPerDay: options.overtimeHoursPerDay,
      daysPerWeek: 5,
      shiftStartHour: 8
    },
    notes: 'available for diagnostics',
    developmentPlan: [
      { skillKey: 'maintenance', minSkill01: 0.5 }
    ],
    baseRateMultiplier: 1,
    experience: { hoursAccrued: 0, level01: 0 },
    laborMarketFactor: 1,
    timePremiumMultiplier: 1,
    employmentStartDay: 0,
    salaryExpectation_per_h: 18,
    raise: { cadenceSequence: 0 }
  });

  if (!options.gender) {
    return base;
  }

  return { ...base, gender: options.gender };
}

function createStructure(id: string, slug: string, name: string): Structure {
  return {
    id: uuidSchema.parse(id),
    slug,
    name,
    floorArea_m2: 400,
    height_m: 3,
    rooms: [],
    devices: []
  } satisfies Structure;
}

describe('createWorkforceView', () => {
  it('projects workforce state into directory, queue, KPI and warning views', () => {
    const gardenerRole = createRole('00000000-0000-0000-0000-000000010001', 'gardener', 'Gardener');
    const technicianRole = createRole('00000000-0000-0000-0000-000000010002', 'technician', 'Technician');

    const structureA = createStructure('00000000-0000-0000-0000-000000030001', 'hq', 'HQ Facility');
    const structureB = createStructure('00000000-0000-0000-0000-000000030002', 'satellite', 'Satellite');

    const employeeA = createEmployee({
      id: '00000000-0000-0000-0000-000000020001',
      name: 'Alex Gardner',
      roleId: gardenerRole.id,
      structureId: structureA.id,
      morale01: 0.82,
      fatigue01: 0.18,
      skillKey: 'gardening',
      skillLevel01: 0.72,
      hoursPerDay: 8,
      overtimeHoursPerDay: 1,
      gender: 'm',
      traits: [
        { traitId: 'trait_green_thumb', strength01: 0.68 },
        { traitId: 'trait_frugal', strength01: 0.45 }
      ]
    });

    const employeeB = createEmployee({
      id: '00000000-0000-0000-0000-000000020002',
      name: 'Billie Technician',
      roleId: technicianRole.id,
      structureId: structureB.id,
      morale01: 0.66,
      fatigue01: 0.34,
      skillKey: 'maintenance',
      skillLevel01: 0.58,
      hoursPerDay: 6,
      overtimeHoursPerDay: 0,
      gender: 'f',
      traits: [{ traitId: 'trait_clumsy', strength01: 0.52 }]
    });

    const harvestDefinition: WorkforceTaskDefinition = {
      taskCode: 'harvest_cycle',
      description: 'Harvest mature plants',
      requiredRoleSlug: 'gardener',
      requiredSkills: [
        { skillKey: 'gardening', minSkill01: 0.6 }
      ],
      priority: 80,
      costModel: { basis: 'perAction', laborMinutes: 120 }
    };

    const maintenanceDefinition: WorkforceTaskDefinition = {
      taskCode: 'repair_device',
      description: 'Repair failing device',
      requiredRoleSlug: 'technician',
      requiredSkills: [
        { skillKey: 'maintenance', minSkill01: 0.5 }
      ],
      priority: 95,
      costModel: { basis: 'perAction', laborMinutes: 90 }
    };

    const harvestTask: WorkforceTaskInstance = workforceTaskInstanceSchema.parse({
      id: uuidSchema.parse('00000000-0000-0000-0000-000000040001'),
      taskCode: 'harvest_cycle',
      status: 'queued',
      createdAtTick: 6,
      dueTick: 12,
      context: { structureId: structureA.id }
    });

    const maintenanceTask: WorkforceTaskInstance = workforceTaskInstanceSchema.parse({
      id: uuidSchema.parse('00000000-0000-0000-0000-000000040002'),
      taskCode: 'repair_device',
      status: 'in-progress',
      createdAtTick: 5,
      assignedEmployeeId: employeeB.id,
      context: { structureId: structureB.id }
    });

    const overtimeWarning: WorkforceWarning = {
      simTimeHours: 10,
      code: 'workforce.overtime.trend',
      message: 'Overtime trending up for Alex Gardner.',
      severity: 'warning',
      employeeId: employeeA.id,
      structureId: structureA.id
    };

    const workforce: WorkforceState = {
      roles: [gardenerRole, technicianRole],
      employees: [employeeA, employeeB],
      taskDefinitions: [harvestDefinition, maintenanceDefinition],
      taskQueue: [harvestTask, maintenanceTask],
      kpis: [
        {
          simTimeHours: 9,
          tasksCompleted: 3,
          queueDepth: 2,
          laborHoursCommitted: 6,
          overtimeHoursCommitted: 1,
          overtimeMinutes: 60,
          utilization01: 0.65,
          p95WaitTimeHours: 4,
          maintenanceBacklog: 1,
          averageMorale01: 0.74,
          averageFatigue01: 0.26
        },
        {
          simTimeHours: 10,
          tasksCompleted: 5,
          queueDepth: 1,
          laborHoursCommitted: 7,
          overtimeHoursCommitted: 1.5,
          overtimeMinutes: 90,
          utilization01: 0.7,
          p95WaitTimeHours: 3,
          maintenanceBacklog: 0,
          averageMorale01: 0.76,
          averageFatigue01: 0.24
        }
      ],
      warnings: [overtimeWarning],
      payroll: {
        dayIndex: 0,
        totals: {
          baseMinutes: 480,
          otMinutes: 60,
          baseCost: 120,
          otCost: 18,
          totalLaborCost: 138
        },
        byStructure: []
      },
      market: { structures: [] }
    };

    const options: WorkforceViewOptions = {
      structures: [structureA, structureB],
      simTimeHours: 10
    };

    const view = createWorkforceView(workforce, options);

    expect(view.directory.employees).toHaveLength(2);
    expect(view.payroll).toEqual(workforce.payroll);
    const [firstEmployee] = view.directory.employees;
    expect(firstEmployee.moralePercent).toBe(82);
    expect(firstEmployee.fatiguePercent).toBe(18);
    expect(firstEmployee.traits).toEqual([
      {
        id: 'trait_green_thumb',
        name: 'Green Thumb',
        description:
          'Naturally gifted with plants, providing a slight bonus to all gardening tasks.',
        type: 'positive',
        strength01: 0.68,
        strengthPercent: 68,
        economyHint: undefined,
        focusSkills: ['gardening']
      },
      {
        id: 'trait_frugal',
        name: 'Frugal',
        description: 'Accepts a slightly lower salary than their skills would normally demand.',
        type: 'positive',
        strength01: 0.45,
        strengthPercent: 45,
        economyHint: 'Accepts a lower base salary expectation.',
        focusSkills: []
      }
    ]);
    expect(view.directory.filters.structures).toEqual([
      { value: structureA.id, label: 'HQ Facility', count: 1 },
      { value: structureB.id, label: 'Satellite', count: 1 }
    ]);
    expect(view.directory.filters.roles).toEqual([
      { value: gardenerRole.id, label: 'Gardener', count: 1 },
      { value: technicianRole.id, label: 'Technician', count: 1 }
    ]);
    expect(view.directory.filters.skills).toEqual([
      { value: 'gardening', label: 'gardening', count: 1 },
      { value: 'maintenance', label: 'maintenance', count: 1 }
    ]);
    expect(view.directory.filters.genders).toEqual([
      { value: 'f', label: 'Female', count: 1 },
      { value: 'm', label: 'Male', count: 1 }
    ]);

    expect(view.queue.map((task) => task.taskCode)).toEqual([
      'repair_device',
      'harvest_cycle'
    ]);
    const [topTask] = view.queue;
    expect(topTask.assignedEmployeeName).toBe('Billie Technician');
    expect(topTask.etaHours).toBeCloseTo(1.5, 5);
    expect(topTask.structureName).toBe('Satellite');

    expect(view.latestKpi?.utilizationPercent).toBe(70);
    expect(view.latestKpi?.averageMoralePercent).toBe(76);

    expect(view.warnings).toEqual([
      {
        ...overtimeWarning,
        structureName: 'HQ Facility',
        employeeName: 'Alex Gardner'
      }
    ]);

    const detail = view.employeeDetails[employeeA.id];
    expect(detail.schedule.hoursPerDay).toBe(8);
    expect(detail.developmentPlan?.[0]?.skillKey).toBe('maintenance');
    expect(detail.traits).toEqual(firstEmployee.traits);
  });
});
