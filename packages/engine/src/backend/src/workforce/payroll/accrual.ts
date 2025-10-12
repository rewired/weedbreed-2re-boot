import type {
  CompanyLocation,
  Employee,
  EmployeeRole,
  Structure,
  WorkforcePayrollState,
  WorkforceStructurePayrollTotals,
  WorkforceTaskDefinition,
} from '../../domain/world.ts';
import { MIN_BASE_RATE_MULTIPLIER, MIN_TIME_PREMIUM_MULTIPLIER } from '../../constants/simConstants.ts';
import { bankersRound, clamp01 } from '../../util/math.ts';
import { computeExperienceMultiplier } from '../traits/effects.ts';

export interface PayrollAccumulator {
  baseMinutes: number;
  otMinutes: number;
  baseCost: number;
  otCost: number;
  totalLaborCost: number;
}

export const BASE_WAGE_PER_HOUR = 5;
export const SKILL_WAGE_RATE_PER_POINT = 10;
export const OVERTIME_RATE_MULTIPLIER = 1.25;
/* eslint-disable @typescript-eslint/no-magic-numbers -- Skill normalisation uses fixed neutral midpoint */
const DEFAULT_SKILL_LEVEL01 = 0.5 as const;
/* eslint-enable @typescript-eslint/no-magic-numbers */

export function createEmptyPayrollTotals(): PayrollAccumulator {
  return { baseMinutes: 0, otMinutes: 0, baseCost: 0, otCost: 0, totalLaborCost: 0 };
}

export function clonePayrollTotals(totals: PayrollAccumulator): PayrollAccumulator {
  return { ...totals };
}

export function createEmptyStructurePayrollTotals(
  structureId: Structure['id'],
): WorkforceStructurePayrollTotals {
  return { structureId, ...createEmptyPayrollTotals() } satisfies WorkforceStructurePayrollTotals;
}

export function cloneStructurePayroll(
  entries: readonly WorkforceStructurePayrollTotals[],
): Map<Structure['id'], WorkforceStructurePayrollTotals> {
  const map = new Map<Structure['id'], WorkforceStructurePayrollTotals>();

  for (const entry of entries) {
    map.set(entry.structureId, { ...entry });
  }

  return map;
}

export function ensureStructurePayroll(
  map: Map<Structure['id'], WorkforceStructurePayrollTotals>,
  structureId: Structure['id'],
): WorkforceStructurePayrollTotals {
  const current = map.get(structureId);

  if (current) {
    return current;
  }

  const created = createEmptyStructurePayrollTotals(structureId);
  map.set(structureId, created);
  return created;
}

export function applyPayrollContribution(
  target: PayrollAccumulator,
  contribution: PayrollAccumulator,
): void {
  target.baseMinutes += contribution.baseMinutes;
  target.otMinutes += contribution.otMinutes;
  target.baseCost += contribution.baseCost;
  target.otCost += contribution.otCost;
  target.totalLaborCost = target.baseCost + target.otCost;
}

export function resolveRelevantSkillLevel(
  employee: Employee,
  definition: WorkforceTaskDefinition,
): number {
  if (definition.requiredSkills.length === 0) {
    if (employee.skills.length === 0) {
      return DEFAULT_SKILL_LEVEL01;
    }

    const sum = employee.skills.reduce((acc, skill) => acc + clamp01(skill.level01), 0);
    return clamp01(sum / employee.skills.length);
  }

  let total = 0;

  for (const requirement of definition.requiredSkills) {
    const skill = employee.skills.find((entry) => entry.skillKey === requirement.skillKey);
    total += clamp01(skill?.level01 ?? 0);
  }

  return definition.requiredSkills.length > 0
    ? clamp01(total / definition.requiredSkills.length)
    : DEFAULT_SKILL_LEVEL01;
}

export function computePayrollContribution(
  employee: Employee,
  role: EmployeeRole | undefined,
  definition: WorkforceTaskDefinition,
  baseMinutes: number,
  overtimeMinutes: number,
  locationIndex: number,
): PayrollAccumulator {
  const base = Math.max(0, baseMinutes);
  const overtime = Math.max(0, overtimeMinutes);

  if (base <= 0 && overtime <= 0) {
    return createEmptyPayrollTotals();
  }

  const skillLevel = resolveRelevantSkillLevel(employee, definition);
  const normalizedIndex = Math.max(0, Number.isFinite(locationIndex) ? locationIndex : 1);
  const roleMultiplier = Math.max(MIN_BASE_RATE_MULTIPLIER, role?.baseRateMultiplier ?? 1);
  const employeeMultiplier = Math.max(MIN_BASE_RATE_MULTIPLIER, employee.baseRateMultiplier);
  const laborMarketFactor = Math.max(MIN_BASE_RATE_MULTIPLIER, employee.laborMarketFactor);
  const experienceMultiplier = computeExperienceMultiplier(employee.experience);
  const timePremiumMultiplier = Math.max(MIN_TIME_PREMIUM_MULTIPLIER, employee.timePremiumMultiplier);
  const hourlyBase = BASE_WAGE_PER_HOUR + SKILL_WAGE_RATE_PER_POINT * skillLevel;
  const hourlyRate =
    hourlyBase * normalizedIndex * roleMultiplier * employeeMultiplier * laborMarketFactor * experienceMultiplier;
  const premiumRate = hourlyRate * timePremiumMultiplier;
  const baseCost = (premiumRate / 60) * base;
  const overtimeCost = ((premiumRate * OVERTIME_RATE_MULTIPLIER) / 60) * overtime;

  return {
    baseMinutes: base,
    otMinutes: overtime,
    baseCost,
    otCost: overtimeCost,
    totalLaborCost: baseCost + overtimeCost,
  } satisfies PayrollAccumulator;
}

export function resolveStructureLocation(
  structure: Structure | undefined,
  companyLocation: CompanyLocation,
): CompanyLocation {
  if (structure) {
    const { location } = structure as Structure & { location?: CompanyLocation };

    if (location?.cityName && location.countryName) {
      return location;
    }
  }

  return companyLocation;
}

export function materializeStructurePayroll(
  map: Map<Structure['id'], WorkforceStructurePayrollTotals>,
): WorkforceStructurePayrollTotals[] {
  return [...map.values()]
    .map((entry) => ({ ...entry }))
    .sort((a, b) => a.structureId.localeCompare(b.structureId));
}

export function createEmptyPayrollState(dayIndex: number): WorkforcePayrollState {
  return {
    dayIndex,
    totals: createEmptyPayrollTotals(),
    byStructure: [],
  } satisfies WorkforcePayrollState;
}

export function finalizePayrollState(state: WorkforcePayrollState): WorkforcePayrollState {
  const roundedTotals = {
    baseMinutes: Math.trunc(Math.max(0, state.totals.baseMinutes)),
    otMinutes: Math.trunc(Math.max(0, state.totals.otMinutes)),
    baseCost: bankersRound(state.totals.baseCost),
    otCost: bankersRound(state.totals.otCost),
    totalLaborCost: 0,
  } satisfies PayrollAccumulator;
  roundedTotals.totalLaborCost = bankersRound(roundedTotals.baseCost + roundedTotals.otCost);

  const roundedStructures = state.byStructure
    .map((entry) => {
      const baseCost = bankersRound(entry.baseCost);
      const otCost = bankersRound(entry.otCost);
      const totalLaborCost = bankersRound(baseCost + otCost);
      return {
        structureId: entry.structureId,
        baseMinutes: Math.trunc(Math.max(0, entry.baseMinutes)),
        otMinutes: Math.trunc(Math.max(0, entry.otMinutes)),
        baseCost,
        otCost,
        totalLaborCost,
      } satisfies WorkforceStructurePayrollTotals;
    })
    .sort((a, b) => a.structureId.localeCompare(b.structureId));

  return {
    dayIndex: Math.trunc(Math.max(0, state.dayIndex)),
    totals: roundedTotals,
    byStructure: roundedStructures,
  } satisfies WorkforcePayrollState;
}
