import { describe, expect, it } from 'vitest';

import { uuidSchema, type Employee, type WorkforceState } from '@wb/engine';
import { createTraitBreakdown } from '../../../src/readModels/traitBreakdownView.ts';

function buildEmployee(partial: Partial<Employee>): Employee {
  return {
    id: uuidSchema.parse('00000000-0000-0000-0000-00000000aaaa'),
    name: 'Trait Tester',
    roleId: uuidSchema.parse('00000000-0000-0000-0000-00000000bbbb'),
    rngSeedUuid: '018f43f1-8b44-7b74-b3ce-5fbd7be3c201',
    assignedStructureId: uuidSchema.parse('00000000-0000-0000-0000-00000000cccc'),
    morale01: 0.7,
    fatigue01: 0.2,
    skills: [],
    schedule: {
      hoursPerDay: 8,
      overtimeHoursPerDay: 0,
      daysPerWeek: 5,
    },
    skillTriad: {
      main: { skillKey: 'general', level01: 0.5 },
      secondary: [
        { skillKey: 'secondary_a', level01: 0.3 },
        { skillKey: 'secondary_b', level01: 0.2 },
      ],
    },
    baseRateMultiplier: 1,
    experience: { hoursAccrued: 0, level01: 0 },
    laborMarketFactor: 1,
    timePremiumMultiplier: 1,
    employmentStartDay: 0,
    salaryExpectation_per_h: 15,
    raise: { cadenceSequence: 0, nextEligibleDay: 180 },
    traits: [],
    ...partial,
  } satisfies Employee;
}

describe('createTraitBreakdown', () => {
  it('aggregates trait counts and averages strengths', () => {
    const workforce: WorkforceState = {
      roles: [],
      employees: [
        buildEmployee({
          id: uuidSchema.parse('00000000-0000-0000-0000-00000000d001'),
          traits: [
            { traitId: 'trait_green_thumb', strength01: 0.6 },
            { traitId: 'trait_frugal', strength01: 0.5 },
          ],
        }),
        buildEmployee({
          id: uuidSchema.parse('00000000-0000-0000-0000-00000000d002'),
          traits: [
            { traitId: 'trait_green_thumb', strength01: 0.8 },
            { traitId: 'trait_clumsy', strength01: 0.4 },
          ],
        }),
        buildEmployee({
          id: uuidSchema.parse('00000000-0000-0000-0000-00000000d003'),
          traits: [],
        }),
      ],
      taskDefinitions: [],
      taskQueue: [],
      kpis: [],
      warnings: [],
      payroll: {
        dayIndex: 0,
        totals: { baseMinutes: 0, otMinutes: 0, baseCost: 0, otCost: 0, totalLaborCost: 0 },
        byStructure: [],
      },
      market: { structures: [] },
    } satisfies WorkforceState;

    const breakdown = createTraitBreakdown(workforce);

    expect(breakdown.totals).toMatchObject({
      employeesWithTraits: 2,
      totalTraits: 4,
      positiveCount: 3,
      negativeCount: 1,
    });

    expect(breakdown.traits).toEqual([
      {
        id: 'trait_green_thumb',
        name: 'Green Thumb',
        type: 'positive',
        count: 2,
        averageStrength01: 0.7,
        averageStrengthPercent: 70,
        description:
          'Naturally gifted with plants, providing a slight bonus to all gardening tasks.',
        economyHint: undefined,
        focusSkills: ['gardening'],
      },
      {
        id: 'trait_clumsy',
        name: 'Clumsy',
        type: 'negative',
        count: 1,
        averageStrength01: 0.4,
        averageStrengthPercent: 40,
        description:
          'Slightly increases the chance of minor errors during maintenance tasks.',
        economyHint: undefined,
        focusSkills: [],
      },
      {
        id: 'trait_frugal',
        name: 'Frugal',
        type: 'positive',
        count: 1,
        averageStrength01: 0.5,
        averageStrengthPercent: 50,
        description:
          'Accepts a slightly lower salary than their skills would normally demand.',
        economyHint: 'Accepts a lower base salary expectation.',
        focusSkills: [],
      },
    ]);
  });
});
