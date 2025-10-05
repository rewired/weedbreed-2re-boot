import { describe, expect, it } from 'vitest';

import {
  employeeSchema,
  workforceStateSchema,
  workforceTaskDefinitionSchema
} from '@/backend/src/domain/schemas.js';

const VALID_EMPLOYEE = {
  id: '00000000-0000-0000-0000-000000002001',
  name: 'Alex Example',
  roleId: '00000000-0000-0000-0000-000000001001',
  rngSeedUuid: '018f43f1-8b44-7b74-b3ce-5fbd7be3c201',
  assignedStructureId: '00000000-0000-0000-0000-000000003001',
  morale01: 0.75,
  fatigue01: 0.25,
  skills: [
    {
      skillKey: 'gardening',
      level01: 0.6
    }
  ],
  skillTriad: {
    main: { skillKey: 'gardening', level01: 0.6 },
    secondary: [
      { skillKey: 'maintenance', level01: 0.4 },
      { skillKey: 'cleanliness', level01: 0.3 }
    ]
  },
  traits: [
    { traitId: 'trait_green_thumb', strength01: 0.6 }
  ],
  developmentPlan: [
    {
      skillKey: 'maintenance',
      minSkill01: 0.5
    }
  ],
  schedule: {
    hoursPerDay: 8,
    overtimeHoursPerDay: 2,
    daysPerWeek: 5,
    shiftStartHour: 6
  },
  notes: 'Senior grow technician'
};

const VALID_WORKFORCE_STATE = {
  roles: [
    {
      id: '00000000-0000-0000-0000-000000001001',
      slug: 'gardener',
      name: 'Gardener',
      coreSkills: [
        {
          skillKey: 'gardening',
          minSkill01: 0.5
        }
      ]
    }
  ],
  employees: [VALID_EMPLOYEE],
  taskDefinitions: [
    {
      taskCode: 'harvest_plants',
      description: 'Harvest mature plants in a grow zone.',
      requiredRoleSlug: 'gardener',
      requiredSkills: [
        {
          skillKey: 'gardening',
          minSkill01: 0.5
        }
      ],
      priority: 80,
      costModel: {
        basis: 'perPlant',
        laborMinutes: 5
      }
    }
  ],
  taskQueue: [
    {
      id: '00000000-0000-0000-0000-000000004001',
      taskCode: 'harvest_plants',
      status: 'queued',
      createdAtTick: 12,
      context: {
        zoneId: '00000000-0000-0000-0000-000000005001'
      }
    }
  ],
  kpis: [
    {
      simTimeHours: 24,
      tasksCompleted: 5,
      queueDepth: 3,
      laborHoursCommitted: 12,
      overtimeHoursCommitted: 3,
      overtimeMinutes: 180,
      utilization01: 0.7,
      p95WaitTimeHours: 4,
      maintenanceBacklog: 1,
      averageMorale01: 0.8,
      averageFatigue01: 0.2
    }
  ],
  warnings: [
    {
      simTimeHours: 24,
      code: 'workforce.overtime.trend',
      message: 'Overtime usage exceeded 3 hours on the last tick.',
      severity: 'warning',
      employeeId: '00000000-0000-0000-0000-000000002001',
    }
  ],
  payroll: {
    dayIndex: 0,
    totals: {
      baseMinutes: 0,
      otMinutes: 0,
      baseCost: 0,
      otCost: 0,
      totalLaborCost: 0
    },
    byStructure: []
  },
  market: {
    structures: [
      {
        structureId: '00000000-0000-0000-0000-000000003001',
        lastScanDay: 12,
        scanCounter: 1,
        pool: [
          {
            id: '00000000-0000-0000-0000-000000006001',
            structureId: '00000000-0000-0000-0000-000000003001',
            roleSlug: 'gardener',
            skills3: {
              main: { slug: 'gardening', value01: 0.5 },
              secondary: [
                { slug: 'maintenance', value01: 0.35 },
                { slug: 'logistics', value01: 0.3 }
              ]
            },
            traits: [
              { id: 'trait_green_thumb', strength01: 0.6 }
            ],
            expectedBaseRate_per_h: 24,
            validUntilScanCounter: 2,
            scanCounter: 1
          }
        ]
      }
    ]
  }
};

describe('workforce schemas', () => {
  it('accepts a valid employee and enforces deterministic uuid v7 seeds', () => {
    const parsed = employeeSchema.parse(VALID_EMPLOYEE);

    expect(parsed.rngSeedUuid).toBe(VALID_EMPLOYEE.rngSeedUuid);
  });

  it('rejects employees with non v7 rng seeds', () => {
    expect(() =>
      employeeSchema.parse({
        ...VALID_EMPLOYEE,
        rngSeedUuid: '00000000-0000-0000-0000-000000000000'
      })
    ).toThrowError(/Expected a UUID v7 identifier\./);
  });

  it('rejects employees with schedules outside allowed working hours', () => {
    expect(() =>
      employeeSchema.parse({
        ...VALID_EMPLOYEE,
        schedule: {
          ...VALID_EMPLOYEE.schedule,
          hoursPerDay: 4
        }
      })
    ).toThrowError(/hoursPerDay must be at least 5 hours\./);

    expect(() =>
      employeeSchema.parse({
        ...VALID_EMPLOYEE,
        schedule: {
          ...VALID_EMPLOYEE.schedule,
          overtimeHoursPerDay: 6
        }
      })
    ).toThrowError(/overtimeHoursPerDay must not exceed 5 hours\./);
  });

  it('requires skill thresholds to remain within the 0..1 scale', () => {
    const result = workforceTaskDefinitionSchema.safeParse({
      taskCode: 'invalid-skill-threshold',
      description: 'Sanity check task',
      requiredRoleSlug: 'gardener',
      requiredSkills: [
        {
          skillKey: 'gardening',
          minSkill01: 1.2
        }
      ],
      priority: 10,
      costModel: {
        basis: 'perAction',
        laborMinutes: 5
      }
    });

    expect(result.success).toBe(false);
  });

  it('parses a full workforce state snapshot', () => {
    const parsed = workforceStateSchema.parse(VALID_WORKFORCE_STATE);

    expect(parsed.roles).toHaveLength(1);
    expect(parsed.employees).toHaveLength(1);
    expect(parsed.taskQueue[0]?.status).toBe('queued');
    expect(parsed.kpis[0]?.queueDepth).toBe(3);
  });
});
