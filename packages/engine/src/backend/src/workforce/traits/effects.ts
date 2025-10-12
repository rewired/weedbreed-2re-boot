import { HOURS_PER_DAY } from '@/backend/src/constants/simConstants';
import type {
  Employee,
  WorkforceTaskDefinition,
  WorkforceTaskInstance,
} from '../../domain/world.ts';
import { applyTraitEffects, type TraitEffectBreakdownEntry } from '../../domain/workforce/traits.ts';
import { clamp01 } from '../../util/math.ts';

export const OVERTIME_MORALE_PENALTY_PER_HOUR = 0.02;
export const MAX_DAILY_MORALE_PENALTY = 0.1;
export const FATIGUE_GAIN_PER_HOUR = 0.01;
export const BREAKROOM_FATIGUE_RECOVERY_PER_HALF_HOUR = 0.02;
export const EXPERIENCE_CAP_HOURS = 4000;
export const EXPERIENCE_MULTIPLIER_BONUS = 0.25;

export interface TaskTraitEffects {
  readonly durationMinutes: number;
  readonly errorRate01: number;
  readonly deviceWearMultiplier: number;
  readonly xpRateMultiplier: number;
  readonly breakdown: readonly TraitEffectBreakdownEntry[];
}

export interface WellbeingTraitEffects {
  readonly employee: Employee;
  readonly fatigueDelta: number;
  readonly moraleDelta: number;
  readonly breakdown: readonly TraitEffectBreakdownEntry[];
}

export function createInitialExperience(): Employee['experience'] {
  return { hoursAccrued: 0, level01: 0 } satisfies Employee['experience'];
}

export function computeExperienceMultiplier(experience: Employee['experience']): number {
  return 1 + EXPERIENCE_MULTIPLIER_BONUS * clamp01(experience.level01);
}

export function accrueExperience(
  experience: Employee['experience'],
  minutesWorked: number,
  xpRateMultiplier: number,
): Employee['experience'] {
  const hoursWorked = Math.max(0, minutesWorked / 60);
  const adjustedHours = hoursWorked * Math.max(0, xpRateMultiplier);

  if (adjustedHours <= 0) {
    return experience;
  }

  const hoursAccrued = experience.hoursAccrued + adjustedHours;
  const level01 = clamp01(hoursAccrued / EXPERIENCE_CAP_HOURS);

  if (hoursAccrued === experience.hoursAccrued && level01 === experience.level01) {
    return experience;
  }

  return { hoursAccrued, level01 } satisfies Employee['experience'];
}

export function evaluateTaskTraitEffects(
  employee: Employee,
  definition: WorkforceTaskDefinition,
  demandMinutes: number,
  simTimeHours: number,
): TaskTraitEffects {
  const hourOfDay = ((Math.trunc(simTimeHours) % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
  const traitEffect = applyTraitEffects(
    employee,
    {
      taskDurationMinutes: demandMinutes,
      taskErrorRate01: 0,
      deviceWearMultiplier: 1,
      xpRateMultiplier: 1,
    },
    { taskDefinition: definition, hourOfDay },
  );

  return {
    durationMinutes: Math.max(0, traitEffect.values.taskDurationMinutes ?? demandMinutes),
    errorRate01: clamp01(traitEffect.values.taskErrorRate01 ?? 0),
    deviceWearMultiplier: traitEffect.values.deviceWearMultiplier ?? 1,
    xpRateMultiplier: traitEffect.values.xpRateMultiplier ?? 1,
    breakdown: traitEffect.breakdown,
  } satisfies TaskTraitEffects;
}

function isBreakroomTask(task: WorkforceTaskInstance): boolean {
  const context = task.context ?? {};
  const rawPurpose = context.roomPurpose ?? context.purpose;
  const purpose = typeof rawPurpose === 'string' ? rawPurpose.toLowerCase() : '';

  if (purpose === 'breakroom' || context.breakroom === true) {
    return true;
  }

  return task.taskCode.toLowerCase().includes('breakroom');
}

export function evaluateWellbeingTraitEffects(
  employee: Employee,
  usageMoralePenalty: { moralePenalty: number },
  evaluation: { baseMinutes: number; overtimeMinutes: number },
  task: WorkforceTaskInstance,
  definition: WorkforceTaskDefinition,
  simTimeHours: number,
): WellbeingTraitEffects {
  const totalMinutes = evaluation.baseMinutes + evaluation.overtimeMinutes;
  const breakTask = isBreakroomTask(task);

  let fatigueDelta = 0;

  if (breakTask) {
    fatigueDelta = -Math.max(0, (totalMinutes / 30) * BREAKROOM_FATIGUE_RECOVERY_PER_HALF_HOUR);
  } else {
    fatigueDelta = (totalMinutes / 60) * FATIGUE_GAIN_PER_HOUR;
  }

  let moraleDelta = 0;

  if (evaluation.overtimeMinutes > 0) {
    const penaltyHours = evaluation.overtimeMinutes / 60;
    const potentialPenalty = penaltyHours * OVERTIME_MORALE_PENALTY_PER_HOUR;
    const remainingCap = Math.max(0, MAX_DAILY_MORALE_PENALTY - usageMoralePenalty.moralePenalty);
    const appliedPenalty = Math.min(potentialPenalty, remainingCap);
    usageMoralePenalty.moralePenalty += appliedPenalty;
    moraleDelta -= appliedPenalty;
  }

  const hourOfDay = ((Math.trunc(simTimeHours) % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
  const wellbeingEffect = applyTraitEffects(
    employee,
    { fatigueDelta, moraleDelta },
    { taskDefinition: definition, hourOfDay, isBreakTask: breakTask },
  );

  const adjustedFatigue = wellbeingEffect.values.fatigueDelta ?? fatigueDelta;
  const adjustedMorale = wellbeingEffect.values.moraleDelta ?? moraleDelta;
  const nextMorale = clamp01(employee.morale01 + adjustedMorale);
  const nextFatigue = clamp01(Math.max(0, employee.fatigue01 + adjustedFatigue));

  if (nextMorale === employee.morale01 && nextFatigue === employee.fatigue01) {
    return {
      employee,
      fatigueDelta: adjustedFatigue,
      moraleDelta: adjustedMorale,
      breakdown: wellbeingEffect.breakdown,
    } satisfies WellbeingTraitEffects;
  }

  return {
    employee: {
      ...employee,
      morale01: nextMorale,
      fatigue01: nextFatigue,
    },
    fatigueDelta: adjustedFatigue,
    moraleDelta: adjustedMorale,
    breakdown: wellbeingEffect.breakdown,
  } satisfies WellbeingTraitEffects;
}
