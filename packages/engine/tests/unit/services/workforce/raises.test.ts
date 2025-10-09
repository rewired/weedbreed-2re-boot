import { describe, expect, it } from 'vitest';

import {
  applyRaiseIntent,
  createInitialRaiseState,
  RAISE_COOLDOWN_DAYS,
  RAISE_MIN_EMPLOYMENT_DAYS,
} from '@/backend/src/services/workforce/raises';
import { createRng } from '@/backend/src/util/rng';
import type { Employee, WorkforceRaiseIntent } from '@/backend/src/domain/world';

function createEmployee(overrides: Partial<Employee> = {}): Employee {
  const base: Employee = {
    id: '00000000-0000-0000-0000-00000000aaaa' as Employee['id'],
    name: 'Cadence Tester',
    roleId: '00000000-0000-0000-0000-00000000bbbb' as Employee['roleId'],
    rngSeedUuid: '018f43f1-8b44-7b74-b3ce-5fbd7be3c201',
    assignedStructureId: '00000000-0000-0000-0000-00000000cccc' as Employee['assignedStructureId'],
    morale01: 0.7,
    fatigue01: 0.2,
    skills: [{ skillKey: 'analysis', level01: 0.6 }],
    skillTriad: {
      main: { skillKey: 'analysis', level01: 0.6 },
      secondary: [
        { skillKey: 'communication', level01: 0.4 },
        { skillKey: 'operations', level01: 0.3 },
      ],
    },
    traits: [],
    schedule: {
      hoursPerDay: 8,
      overtimeHoursPerDay: 1,
      daysPerWeek: 5,
      shiftStartHour: 8,
    },
    baseRateMultiplier: 1,
    experience: { hoursAccrued: 0, level01: 0 },
    laborMarketFactor: 1,
    timePremiumMultiplier: 1,
    employmentStartDay: 0,
    salaryExpectation_per_h: 18,
    raise: createInitialRaiseState(0),
  } satisfies Employee;

  return { ...base, ...overrides } satisfies Employee;
}

describe('workforce raise cadence', () => {
  it('blocks raise intents before the employment gate', () => {
    const employee = createEmployee();
    const intent: WorkforceRaiseIntent = {
      type: 'workforce.raise.accept',
      employeeId: employee.id,
    };

    const outcome = applyRaiseIntent({ employee, intent, currentSimDay: 90 });

    expect(outcome).toBeNull();
  });

  it('applies raise acceptance and schedules deterministic cooldowns', () => {
    const employee = createEmployee();
    const currentSimDay = RAISE_MIN_EMPLOYMENT_DAYS;
    const intent: WorkforceRaiseIntent = {
      type: 'workforce.raise.accept',
      employeeId: employee.id,
    };

    const outcome = applyRaiseIntent({ employee, intent, currentSimDay });

    expect(outcome).not.toBeNull();
    const result = outcome!;

    expect(result.moraleDelta01).toBeCloseTo(0.06);
    expect(result.rateIncreaseFactor).toBeCloseTo(0.05);
    expect(result.employee.baseRateMultiplier).toBeCloseTo(1.05, 5);
    expect(result.employee.salaryExpectation_per_h).toBeCloseTo(18.9, 5);
    expect(result.employee.morale01).toBeCloseTo(0.76, 5);
    expect(result.employee.raise.cadenceSequence).toBe(1);
    expect(result.employee.raise.lastDecisionDay).toBe(currentSimDay);

    const rng = createRng(employee.rngSeedUuid, 'workforce:raise:1');
    const jitter = Math.round((rng() * 2 - 1) * 45);
    const expectedNext = Math.max(
      currentSimDay + RAISE_MIN_EMPLOYMENT_DAYS,
      currentSimDay + RAISE_COOLDOWN_DAYS + jitter,
    );
    expect(result.employee.raise.nextEligibleDay).toBe(expectedNext);
  });

  it('resets cadence on ignore and applies morale penalties without rate changes', () => {
    const previous = createEmployee({
      morale01: 0.82,
      baseRateMultiplier: 1.1,
      raise: { cadenceSequence: 1, lastDecisionDay: 200, nextEligibleDay: 380 },
      employmentStartDay: 0,
    });

    const intent: WorkforceRaiseIntent = {
      type: 'workforce.raise.ignore',
      employeeId: previous.id,
    };

    const outcome = applyRaiseIntent({ employee: previous, intent, currentSimDay: 400 });

    expect(outcome).not.toBeNull();
    const result = outcome!;

    expect(result.employee.baseRateMultiplier).toBeCloseTo(1.1, 5);
    expect(result.employee.morale01).toBeLessThan(previous.morale01);
    expect(result.moraleDelta01).toBeCloseTo(-0.08, 5);
    expect(result.employee.raise.cadenceSequence).toBe(2);
    expect(result.employee.raise.lastDecisionDay).toBe(400);
    expect(result.employee.raise.nextEligibleDay).toBeGreaterThanOrEqual(
      400 + RAISE_MIN_EMPLOYMENT_DAYS,
    );
  });

  it('allows bonus raises with custom rate increases', () => {
    const employee = createEmployee({
      raise: { cadenceSequence: 4, lastDecisionDay: 500, nextEligibleDay: 680 },
      employmentStartDay: 0,
    });

    const intent: WorkforceRaiseIntent = {
      type: 'workforce.raise.bonus',
      employeeId: employee.id,
      rateIncreaseFactor: 0.02,
      bonusAmount_cc: 500,
      moraleBoost01: 0.05,
    };

    const outcome = applyRaiseIntent({ employee, intent, currentSimDay: 700 });

    expect(outcome).not.toBeNull();
    const result = outcome!;

    expect(result.rateIncreaseFactor).toBeCloseTo(0.02, 5);
    expect(result.employee.baseRateMultiplier).toBeCloseTo(1.02, 5);
    expect(result.employee.morale01).toBeCloseTo(employee.morale01 + 0.05, 5);
    expect(result.employee.raise.cadenceSequence).toBe(5);
    expect(result.employee.raise.nextEligibleDay).toBeGreaterThanOrEqual(
      700 + RAISE_MIN_EMPLOYMENT_DAYS,
    );
    expect(result.bonusAmount_cc).toBe(500);
  });
});
