import { clamp01 } from '../../util/math.js';
import { createRng } from '../../util/rng.js';
import type {
  Employee,
  EmployeeRaiseState,
} from '../../domain/workforce/Employee.js';
import type {
  WorkforceRaiseBonusIntent,
  WorkforceRaiseIntent,
} from '../../domain/workforce/intents.js';

const RAISE_ACCEPT_DEFAULT_RATE_INCREASE = 0.05;
const RAISE_BONUS_DEFAULT_RATE_INCREASE = 0.03;
const RAISE_ACCEPT_DEFAULT_MORALE_BOOST = 0.06;
const RAISE_BONUS_DEFAULT_MORALE_BOOST = 0.04;
const RAISE_IGNORE_DEFAULT_MORALE_PENALTY = -0.08;
const RAISE_JITTER_RANGE_DAYS = 45;

export const RAISE_MIN_EMPLOYMENT_DAYS = 180;
export const RAISE_BASE_COOLDOWN_DAYS = 180;

export interface RaiseIntentOutcome {
  readonly employee: Employee;
  readonly moraleDelta01: number;
  readonly rateIncreaseFactor: number;
  readonly action: 'accept' | 'bonus' | 'ignore';
  readonly bonusAmount_cc?: number;
}

function resolveMoraleBoost(intent: WorkforceRaiseIntent): number {
  if (intent.type === 'workforce.raise.ignore') {
    return intent.moralePenalty01 ?? RAISE_IGNORE_DEFAULT_MORALE_PENALTY;
  }

  if (intent.type === 'workforce.raise.accept') {
    return intent.moraleBoost01 ?? RAISE_ACCEPT_DEFAULT_MORALE_BOOST;
  }

  return intent.moraleBoost01 ?? RAISE_BONUS_DEFAULT_MORALE_BOOST;
}

function resolveRateIncrease(intent: WorkforceRaiseIntent): number {
  if (intent.type === 'workforce.raise.accept') {
    return intent.rateIncreaseFactor ?? RAISE_ACCEPT_DEFAULT_RATE_INCREASE;
  }

  if (intent.type === 'workforce.raise.bonus') {
    return intent.rateIncreaseFactor ?? RAISE_BONUS_DEFAULT_RATE_INCREASE;
  }

  return 0;
}

function computeNextEligibleDay(
  employee: Employee,
  currentSimDay: number,
  nextSequence: number,
): number {
  const rng = createRng(employee.rngSeedUuid, `workforce:raise:${nextSequence}`);
  const jitter = Math.round((rng() * 2 - 1) * RAISE_JITTER_RANGE_DAYS);
  const baseTarget = currentSimDay + RAISE_BASE_COOLDOWN_DAYS + jitter;
  const minimum = currentSimDay + RAISE_MIN_EMPLOYMENT_DAYS;
  return Math.max(minimum, baseTarget);
}

export function createInitialRaiseState(
  employmentStartDay: number,
): EmployeeRaiseState {
  const nextEligibleDay = employmentStartDay + RAISE_MIN_EMPLOYMENT_DAYS;
  return {
    cadenceSequence: 0,
    nextEligibleDay,
  } satisfies EmployeeRaiseState;
}

export function applyRaiseIntent(options: {
  readonly employee: Employee;
  readonly intent: WorkforceRaiseIntent;
  readonly currentSimDay: number;
}): RaiseIntentOutcome | null {
  const { employee, intent, currentSimDay } = options;
  const minimumEmploymentDay = employee.employmentStartDay + RAISE_MIN_EMPLOYMENT_DAYS;
  const nextEligibleDay = employee.raise.nextEligibleDay ?? minimumEmploymentDay;

  if (currentSimDay < minimumEmploymentDay || currentSimDay < nextEligibleDay) {
    return null;
  }

  const moraleDelta = resolveMoraleBoost(intent);
  const rateIncrease = resolveRateIncrease(intent);
  const multiplier = 1 + rateIncrease;
  const nextSequence = employee.raise.cadenceSequence + 1;
  const updatedMorale = clamp01(employee.morale01 + moraleDelta);
  const updatedBaseRateMultiplier = Math.max(0.1, employee.baseRateMultiplier * multiplier);
  const updatedSalaryExpectation = Math.max(
    0,
    employee.salaryExpectation_per_h * multiplier,
  );
  const updatedRaiseState: EmployeeRaiseState = {
    cadenceSequence: nextSequence,
    lastDecisionDay: currentSimDay,
    nextEligibleDay: computeNextEligibleDay(employee, currentSimDay, nextSequence),
  };

  const updatedEmployee: Employee = {
    ...employee,
    morale01: updatedMorale,
    baseRateMultiplier: updatedBaseRateMultiplier,
    salaryExpectation_per_h: updatedSalaryExpectation,
    raise: updatedRaiseState,
  };

  return {
    employee: updatedEmployee,
    moraleDelta01: moraleDelta,
    rateIncreaseFactor: rateIncrease,
    action:
      intent.type === 'workforce.raise.accept'
        ? 'accept'
        : intent.type === 'workforce.raise.bonus'
          ? 'bonus'
          : 'ignore',
    bonusAmount_cc: (intent as WorkforceRaiseBonusIntent).bonusAmount_cc,
  } satisfies RaiseIntentOutcome;
}
