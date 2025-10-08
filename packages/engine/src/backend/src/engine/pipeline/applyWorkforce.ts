import { HOURS_PER_DAY } from '../../constants/simConstants.ts';
import { DEFAULT_WORKFORCE_CONFIG, type WorkforceConfig } from '../../config/workforce.ts';
import { bankersRound, clamp01 } from '../../util/math.ts';
import {
  emitWorkforceKpiSnapshot,
  emitWorkforceWarnings,
  emitWorkforcePayrollSnapshot,
  emitWorkforceRaiseEvent,
  emitWorkforceTermination,
  type WorkforceRaiseTelemetryEvent,
  type WorkforceTerminationTelemetryEvent,
} from '../../telemetry/workforce.ts';
import {
  emitHiringEmployeeOnboarded,
  emitHiringMarketScanCompleted,
} from '../../telemetry/hiring.ts';
import type {
  CompanyLocation,
  Employee,
  EmployeeRole,
  HiringMarketHireIntent,
  HiringMarketScanIntent,
  Room,
  SimulationWorld,
  Structure,
  WorkforceKpiSnapshot,
  WorkforceMarketCandidate,
  WorkforceMarketState,
  WorkforcePayrollState,
  WorkforceStructurePayrollTotals,
  WorkforceState,
  WorkforceTaskDefinition,
  WorkforceTaskInstance,
  WorkforceWarning,
  Zone,
  WorkforceIntent,
  WorkforceRaiseIntent,
  WorkforceTerminationIntent,
} from '../../domain/world.ts';
import {
  createEmptyLocationIndexTable,
  resolveLocationIndex,
  type LocationIndexTable,
} from '../../domain/payroll/locationIndex.ts';
import { performMarketHire, performMarketScan } from '../../services/workforce/market.ts';
import { applyRaiseIntent, createInitialRaiseState } from '../../services/workforce/raises.ts';
import type { EngineRunContext as EngineContext } from '../Engine.ts';
import { deterministicUuid, deterministicUuidV7 } from '../../util/uuid.ts';
import {
  applyTraitEffects,
  type TraitEffectBreakdownEntry,
} from '../../domain/workforce/traits.ts';
import { evaluatePestDiseaseSystem } from '../../health/pestDiseaseSystem.ts';
import { emitPestDiseaseRiskWarnings, emitPestDiseaseTaskEvents } from '../../telemetry/health.ts';
import {
  ensureCultivationTaskRuntime,
  getCultivationMethodCatalog,
  scheduleCultivationTasksForZone,
} from '../../cultivation/methodRuntime.ts';
import { consumeDeviceMaintenanceRuntime } from '../../device/maintenanceRuntime.ts';
import {
  TELEMETRY_DEVICE_MAINTENANCE_SCHEDULED_V1,
  TELEMETRY_DEVICE_REPLACEMENT_RECOMMENDED_V1,
} from '../../telemetry/topics.ts';

const SCORE_EPSILON = 1e-6;
const OVERTIME_MORALE_PENALTY_PER_HOUR = 0.02;
const MAX_DAILY_MORALE_PENALTY = 0.1;
const FATIGUE_GAIN_PER_HOUR = 0.01;
const BREAKROOM_FATIGUE_RECOVERY_PER_HALF_HOUR = 0.02;
const BASE_WAGE_PER_HOUR = 5;
const SKILL_WAGE_RATE_PER_POINT = 10;
const OVERTIME_RATE_MULTIPLIER = 1.25;
const EXPERIENCE_CAP_HOURS = 4000;
const EXPERIENCE_MULTIPLIER_BONUS = 0.25;

interface EmployeeUsage {
  baseMinutes: number;
  overtimeMinutes: number;
  moralePenalty: number;
}

export interface WorkforceAssignment {
  readonly taskId: WorkforceTaskInstance['id'];
  readonly employeeId: Employee['id'];
  readonly baseMinutes: number;
  readonly overtimeMinutes: number;
  readonly waitTimeHours: number;
  readonly structureId: Structure['id'];
  readonly taskEffects: {
    readonly durationMinutes: number;
    readonly errorRate01: number;
    readonly deviceWearMultiplier: number;
    readonly xpRateMultiplier: number;
    readonly breakdown: readonly TraitEffectBreakdownEntry[];
  };
  readonly wellbeingEffects: {
    readonly fatigueDelta: number;
    readonly moraleDelta: number;
    readonly breakdown: readonly TraitEffectBreakdownEntry[];
  };
}

export interface WorkforceRuntime {
  readonly assignments: readonly WorkforceAssignment[];
  readonly kpiSnapshot?: WorkforceKpiSnapshot;
}

interface WorkforceRuntimeMutable {
  assignments: WorkforceAssignment[];
  kpiSnapshot?: WorkforceKpiSnapshot;
}

export interface WorkforcePayrollAccrualSnapshot {
  readonly current: WorkforcePayrollState;
  readonly finalized?: WorkforcePayrollState;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type WorkforceRuntimeCarrier = Mutable<EngineContext> & {
  [WORKFORCE_RUNTIME_CONTEXT_KEY]?: WorkforceRuntimeMutable;
};

const WORKFORCE_RUNTIME_CONTEXT_KEY = '__wb_workforceRuntime' as const;
const WORKFORCE_PAYROLL_CONTEXT_KEY = '__wb_workforcePayrollAccrual' as const;

type PayrollContextCarrier = Mutable<EngineContext> & {
  payroll?: { locationIndexTable?: LocationIndexTable };
  [WORKFORCE_PAYROLL_CONTEXT_KEY]?: WorkforcePayrollAccrualSnapshot;
};

const WORKFORCE_MARKET_CHARGES_CONTEXT_KEY = '__wb_workforceMarketCharges' as const;

export interface WorkforceMarketCharge {
  readonly structureId: Structure['id'];
  readonly amountCc: number;
  readonly scanCounter: number;
}

type WorkforceMarketChargeCarrier = Mutable<EngineContext> & {
  [WORKFORCE_MARKET_CHARGES_CONTEXT_KEY]?: WorkforceMarketCharge[];
};

function setWorkforceRuntime(
  ctx: EngineContext,
  runtime: WorkforceRuntimeMutable,
): WorkforceRuntimeMutable {
  (ctx as WorkforceRuntimeCarrier)[WORKFORCE_RUNTIME_CONTEXT_KEY] = runtime;
  return runtime;
}

export function ensureWorkforceRuntime(ctx: EngineContext): WorkforceRuntimeMutable {
  return setWorkforceRuntime(ctx, { assignments: [] });
}

export function getWorkforceRuntime(ctx: EngineContext): WorkforceRuntime | undefined {
  return (ctx as WorkforceRuntimeCarrier)[WORKFORCE_RUNTIME_CONTEXT_KEY];
}

export function clearWorkforceRuntime(ctx: EngineContext): void {
  delete (ctx as WorkforceRuntimeCarrier)[WORKFORCE_RUNTIME_CONTEXT_KEY];
}

function resolveLocationIndexTable(ctx: EngineContext): LocationIndexTable {
  const carrier = ctx as PayrollContextCarrier;
  return carrier.payroll?.locationIndexTable ?? createEmptyLocationIndexTable();
}

function setWorkforcePayrollAccrual(
  ctx: EngineContext,
  snapshot: WorkforcePayrollAccrualSnapshot,
): void {
  (ctx as PayrollContextCarrier)[WORKFORCE_PAYROLL_CONTEXT_KEY] = snapshot;
}

export function consumeWorkforcePayrollAccrual(
  ctx: EngineContext,
): WorkforcePayrollAccrualSnapshot | undefined {
  const carrier = ctx as PayrollContextCarrier;
  const snapshot = carrier[WORKFORCE_PAYROLL_CONTEXT_KEY];

  if (snapshot) {
    delete carrier[WORKFORCE_PAYROLL_CONTEXT_KEY];
    return snapshot;
  }

  return undefined;
}

export function clearWorkforcePayrollAccrual(ctx: EngineContext): void {
  delete (ctx as PayrollContextCarrier)[WORKFORCE_PAYROLL_CONTEXT_KEY];
}

function resolveWorkforceConfig(ctx: EngineContext): WorkforceConfig {
  return (ctx as EngineContext & { workforceConfig?: WorkforceConfig }).workforceConfig ?? DEFAULT_WORKFORCE_CONFIG;
}

function extractWorkforceIntents(ctx: EngineContext): readonly WorkforceIntent[] {
  const carrier = ctx as Mutable<EngineContext> & { workforceIntents?: readonly WorkforceIntent[] };
  const intents = carrier.workforceIntents ?? [];

  if (carrier.workforceIntents) {
    delete carrier.workforceIntents;
  }

  return intents;
}

function recordWorkforceMarketCharge(ctx: EngineContext, charge: WorkforceMarketCharge): void {
  const carrier = ctx as WorkforceMarketChargeCarrier;
  const existing = carrier[WORKFORCE_MARKET_CHARGES_CONTEXT_KEY] ?? [];
  carrier[WORKFORCE_MARKET_CHARGES_CONTEXT_KEY] = [...existing, charge];
}

export function consumeWorkforceMarketCharges(
  ctx: EngineContext,
): readonly WorkforceMarketCharge[] | undefined {
  const carrier = ctx as WorkforceMarketChargeCarrier;
  const charges = carrier[WORKFORCE_MARKET_CHARGES_CONTEXT_KEY];

  if (!charges) {
    return undefined;
  }

  delete carrier[WORKFORCE_MARKET_CHARGES_CONTEXT_KEY];
  return charges;
}

function createInitialExperience(): Employee['experience'] {
  return { hoursAccrued: 0, level01: 0 };
}

function computeExperienceMultiplier(experience: Employee['experience']): number {
  return 1 + EXPERIENCE_MULTIPLIER_BONUS * clamp01(experience.level01);
}

function accrueExperience(
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

  return { hoursAccrued, level01 };
}

function createEmployeeFromCandidate(
  candidate: WorkforceMarketCandidate,
  roles: readonly EmployeeRole[],
  structureId: Structure['id'],
  worldSeed: string,
  currentSimDay: number,
): Employee | undefined {
  const role = roles.find((entry) => entry.slug === candidate.roleSlug);

  if (!role) {
    return undefined;
  }

  const employeeId = deterministicUuid(worldSeed, `workforce:employee:${candidate.id}`);
  const rngSeedUuid = deterministicUuidV7(worldSeed, `workforce:employee-seed:${candidate.id}`);

  const skillMap = new Map<string, number>();
  skillMap.set(candidate.skills3.main.slug, candidate.skills3.main.value01);

  for (const secondary of candidate.skills3.secondary) {
    if (!skillMap.has(secondary.slug)) {
      skillMap.set(secondary.slug, secondary.value01);
    }
  }

  const skills = Array.from(skillMap.entries()).map(([skillKey, level01]) => ({
    skillKey,
    level01,
  }));

  const skillTriad = {
    main: {
      skillKey: candidate.skills3.main.slug,
      level01: candidate.skills3.main.value01,
    },
    secondary: [
      {
        skillKey: candidate.skills3.secondary[0]?.slug ?? candidate.skills3.main.slug,
        level01: candidate.skills3.secondary[0]?.value01 ?? 0,
      },
      {
        skillKey: candidate.skills3.secondary[1]?.slug ?? candidate.skills3.main.slug,
        level01: candidate.skills3.secondary[1]?.value01 ?? 0,
      },
    ],
  } as const;

  const traits = candidate.traits.map((trait) => ({
    traitId: trait.id,
    strength01: clamp01(trait.strength01 ?? 0),
  }));

  const baselineRate = BASE_WAGE_PER_HOUR + SKILL_WAGE_RATE_PER_POINT * candidate.skills3.main.value01;
  const salaryExpectation = Math.max(0, candidate.expectedBaseRate_per_h ?? baselineRate);
  const laborMarketFactor = baselineRate > 0 ? Math.max(0.1, salaryExpectation / baselineRate) : 1;
  const employmentStartDay = Math.max(0, Math.trunc(currentSimDay));

  return {
    id: employeeId,
    name: `${candidate.roleSlug} candidate ${employeeId.slice(0, 8)}`,
    roleId: role.id,
    rngSeedUuid,
    assignedStructureId: structureId,
    morale01: 0.7,
    fatigue01: 0.2,
    skills,
    skillTriad,
    traits,
    schedule: {
      hoursPerDay: 8,
      overtimeHoursPerDay: 0,
      daysPerWeek: 5,
      shiftStartHour: 8,
    },
    baseRateMultiplier: 1,
    experience: createInitialExperience(),
    laborMarketFactor,
    timePremiumMultiplier: 1,
    employmentStartDay,
    salaryExpectation_per_h: salaryExpectation,
    raise: createInitialRaiseState(employmentStartDay),
  } satisfies Employee;
}

interface CandidateEvaluation {
  employee: Employee;
  score: number;
  baseMinutes: number;
  overtimeMinutes: number;
  taskEffects: {
    readonly durationMinutes: number;
    readonly errorRate01: number;
    readonly deviceWearMultiplier: number;
    readonly xpRateMultiplier: number;
    readonly breakdown: readonly TraitEffectBreakdownEntry[];
  };
}

function resolveRoleSlug(roleId: EmployeeRole['id'], roles: readonly EmployeeRole[]): string | null {
  const role = roles.find((entry) => entry.id === roleId);
  return role?.slug ?? null;
}

function ensureUsage(map: Map<Employee['id'], EmployeeUsage>, employeeId: Employee['id']): EmployeeUsage {
  const current = map.get(employeeId);

  if (current) {
    return current;
  }

  const usage: EmployeeUsage = {
    baseMinutes: 0,
    overtimeMinutes: 0,
    moralePenalty: 0,
  };
  map.set(employeeId, usage);
  return usage;
}

interface PayrollAccumulator {
  baseMinutes: number;
  otMinutes: number;
  baseCost: number;
  otCost: number;
  totalLaborCost: number;
}

function createEmptyPayrollTotals(): PayrollAccumulator {
  return { baseMinutes: 0, otMinutes: 0, baseCost: 0, otCost: 0, totalLaborCost: 0 };
}

function createEmptyStructurePayrollTotals(
  structureId: Structure['id'],
): WorkforceStructurePayrollTotals {
  return { structureId, ...createEmptyPayrollTotals() };
}

function clonePayrollTotals(totals: PayrollAccumulator): PayrollAccumulator {
  return { ...totals };
}

function cloneStructurePayroll(
  entries: readonly WorkforceStructurePayrollTotals[],
): Map<Structure['id'], WorkforceStructurePayrollTotals> {
  const map = new Map<Structure['id'], WorkforceStructurePayrollTotals>();

  for (const entry of entries) {
    map.set(entry.structureId, { ...entry });
  }

  return map;
}

function ensureStructurePayroll(
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

function applyPayrollContribution(target: PayrollAccumulator, contribution: PayrollAccumulator): void {
  target.baseMinutes += contribution.baseMinutes;
  target.otMinutes += contribution.otMinutes;
  target.baseCost += contribution.baseCost;
  target.otCost += contribution.otCost;
  target.totalLaborCost = target.baseCost + target.otCost;
}

function resolveRelevantSkillLevel(
  employee: Employee,
  definition: WorkforceTaskDefinition,
): number {
  if (definition.requiredSkills.length === 0) {
    if (employee.skills.length === 0) {
      return 0.5;
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
    : 0.5;
}

function computePayrollContribution(
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
  const roleMultiplier = Math.max(0.1, role?.baseRateMultiplier ?? 1);
  const employeeMultiplier = Math.max(0.1, employee.baseRateMultiplier);
  const laborMarketFactor = Math.max(0.1, employee.laborMarketFactor);
  const experienceMultiplier = computeExperienceMultiplier(employee.experience);
  const timePremiumMultiplier = Math.max(0.5, employee.timePremiumMultiplier);
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

function resolveStructureLocation(
  structure: Structure | undefined,
  companyLocation: CompanyLocation,
): CompanyLocation {
  const candidate = (structure as Structure & { location?: CompanyLocation })?.location;

  if (candidate?.cityName && candidate.countryName) {
    return candidate;
  }

  return companyLocation;
}

function materializeStructurePayroll(
  map: Map<Structure['id'], WorkforceStructurePayrollTotals>,
): WorkforceStructurePayrollTotals[] {
  return [...map.values()]
    .map((entry) => ({ ...entry }))
    .sort((a, b) => a.structureId.localeCompare(b.structureId));
}

function createEmptyPayrollState(dayIndex: number): WorkforcePayrollState {
  return {
    dayIndex,
    totals: createEmptyPayrollTotals(),
    byStructure: [],
  } satisfies WorkforcePayrollState;
}

function finalizePayrollState(state: WorkforcePayrollState): WorkforcePayrollState {
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

function resolveStructureLookups(world: SimulationWorld): {
  readonly roomToStructure: Map<Room['id'], Structure['id']>;
  readonly zoneToStructure: Map<Zone['id'], Structure['id']>;
} {
  const roomToStructure = new Map<Room['id'], Structure['id']>();
  const zoneToStructure = new Map<Zone['id'], Structure['id']>();

  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      roomToStructure.set(room.id, structure.id);

      for (const zone of room.zones) {
        zoneToStructure.set(zone.id, structure.id);
      }
    }
  }

  return { roomToStructure, zoneToStructure };
}

function resolveStructureId(
  task: WorkforceTaskInstance,
  lookups: ReturnType<typeof resolveStructureLookups>,
): Structure['id'] | null {
  const context = (task.context ?? {});
  const explicitStructure = typeof context.structureId === 'string' ? context.structureId : null;

  if (explicitStructure) {
    return explicitStructure as Structure['id'];
  }

  const roomId = typeof context.roomId === 'string' ? (context.roomId as Room['id']) : null;
  if (roomId) {
    const structureId = lookups.roomToStructure.get(roomId);
    if (structureId) {
      return structureId;
    }
  }

  const zoneId = typeof context.zoneId === 'string' ? (context.zoneId as Zone['id']) : null;
  if (zoneId) {
    const structureId = lookups.zoneToStructure.get(zoneId);
    if (structureId) {
      return structureId;
    }
  }

  return null;
}

function resolveTaskDemandMinutes(
  task: WorkforceTaskInstance,
  definition: WorkforceTaskDefinition,
): number {
  const baseMinutes = Math.max(0, Number(definition.costModel.laborMinutes) || 0);
  const context = (task.context ?? {});

  if (baseMinutes <= 0) {
    return 0;
  }

  switch (definition.costModel.basis) {
    case 'perPlant': {
      const plantCountRaw = context.plantCount ?? context.plants ?? 1;
      const plantCount = Number(plantCountRaw);
      return baseMinutes * (Number.isFinite(plantCount) && plantCount > 0 ? plantCount : 1);
    }
    case 'perSquareMeter': {
      const areaRaw = context.area_m2 ?? context.squareMeters ?? context.area ?? 1;
      const area = Number(areaRaw);
      return baseMinutes * (Number.isFinite(area) && area > 0 ? area : 1);
    }
    default:
      return baseMinutes;
  }
}

function computeSkillScore(
  employee: Employee,
  definition: WorkforceTaskDefinition,
): { valid: boolean; score: number } {
  if (definition.requiredSkills.length === 0) {
    const aggregated = employee.skills.reduce((sum, skill) => sum + clamp01(skill.level01), 0);
    const average = employee.skills.length > 0 ? aggregated / employee.skills.length : 0.5;
    return { valid: true, score: clamp01(average) };
  }

  let total = 0;

  for (const requirement of definition.requiredSkills) {
    const skill = employee.skills.find((entry) => entry.skillKey === requirement.skillKey);
    const level = clamp01(skill?.level01 ?? 0);

    if (level < clamp01(requirement.minSkill01)) {
      return { valid: false, score: 0 };
    }

    total += level;
  }

  const average = total / definition.requiredSkills.length;
  return { valid: true, score: clamp01(average) };
}

function evaluateCandidate(
  employee: Employee,
  definition: WorkforceTaskDefinition,
  demandMinutes: number,
  usage: EmployeeUsage,
  simTimeHours: number,
): CandidateEvaluation | null {
  const { valid, score: skillScore } = computeSkillScore(employee, definition);

  if (!valid) {
    return null;
  }

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

  const effectiveDemand = Math.max(0, traitEffect.values.taskDurationMinutes ?? demandMinutes);
  const errorRate01 = traitEffect.values.taskErrorRate01 ?? 0;
  const deviceWearMultiplier = traitEffect.values.deviceWearMultiplier ?? 1;
  const xpRateMultiplier = traitEffect.values.xpRateMultiplier ?? 1;

  const schedule = employee.schedule;
  const baseCapacity = Math.max(0, schedule.hoursPerDay) * 60;
  const overtimeCapacity = Math.max(0, schedule.overtimeHoursPerDay) * 60;
  const totalCapacity = baseCapacity + overtimeCapacity;

  if (totalCapacity <= 0) {
    return null;
  }

  const remainingBase = Math.max(0, baseCapacity - usage.baseMinutes);
  const baseMinutes = Math.min(remainingBase, effectiveDemand);
  const remainingDemand = effectiveDemand - baseMinutes;
  const remainingOvertime = Math.max(0, overtimeCapacity - usage.overtimeMinutes);

  if (remainingDemand > remainingOvertime) {
    return null;
  }

  const overtimeMinutes = Math.max(0, remainingDemand);
  const availability = (remainingBase + remainingOvertime) / totalCapacity;
  const score = clamp01(skillScore) * clamp01(availability);

  return {
    employee,
    score,
    baseMinutes,
    overtimeMinutes,
    taskEffects: {
      durationMinutes: effectiveDemand,
      errorRate01: clamp01(errorRate01),
      deviceWearMultiplier,
      xpRateMultiplier,
      breakdown: traitEffect.breakdown,
    },
  } satisfies CandidateEvaluation;
}

function selectCandidate(
  candidates: readonly CandidateEvaluation[],
  structureIndex: number,
  simTimeHours: number,
): CandidateEvaluation {
  if (candidates.length === 1) {
    return candidates[0];
  }

  let bestScore = -Infinity;

  for (const candidate of candidates) {
    if (candidate.score > bestScore) {
      bestScore = candidate.score;
    }
  }

  const bestCandidates = candidates.filter(
    (candidate) => Math.abs(candidate.score - bestScore) <= SCORE_EPSILON,
  );

  if (bestCandidates.length === 1) {
    return bestCandidates[0];
  }

  const ordered = [...bestCandidates].sort((a, b) => a.employee.id.localeCompare(b.employee.id));
  const rotation = Math.abs(Math.trunc(simTimeHours) + structureIndex);
  const index = rotation % ordered.length;
  return ordered[index];
}

function isBreakroomTask(task: WorkforceTaskInstance): boolean {
  const context = (task.context ?? {});
  const purpose = String(context.roomPurpose ?? context.purpose ?? '').toLowerCase();

  if (purpose === 'breakroom') {
    return true;
  }

  if (context.breakroom === true) {
    return true;
  }

  return task.taskCode.toLowerCase().includes('breakroom');
}

function isMaintenanceTask(task: WorkforceTaskInstance): boolean {
  const lowered = task.taskCode.toLowerCase();
  if (lowered.includes('maint')) {
    return true;
  }

  const context = (task.context ?? {});
  const category = String(context.taskCategory ?? context.category ?? '').toLowerCase();
  return category === 'maintenance';
}

function applyEmployeeAdjustments(
  employee: Employee,
  usage: EmployeeUsage,
  evaluation: CandidateEvaluation,
  task: WorkforceTaskInstance,
  definition: WorkforceTaskDefinition,
  simTimeHours: number,
): {
  readonly employee: Employee;
  readonly fatigueDelta: number;
  readonly moraleDelta: number;
  readonly breakdown: readonly TraitEffectBreakdownEntry[];
} {
  const totalMinutes = evaluation.baseMinutes + evaluation.overtimeMinutes;
  const isBreak = isBreakroomTask(task);
  let fatigueDelta = 0;

  if (isBreak) {
    fatigueDelta = -Math.max(0, (totalMinutes / 30) * BREAKROOM_FATIGUE_RECOVERY_PER_HALF_HOUR);
  } else {
    fatigueDelta = (totalMinutes / 60) * FATIGUE_GAIN_PER_HOUR;
  }

  let moraleDelta = 0;

  if (evaluation.overtimeMinutes > 0) {
    const penaltyHours = evaluation.overtimeMinutes / 60;
    const potentialPenalty = penaltyHours * OVERTIME_MORALE_PENALTY_PER_HOUR;
    const remainingCap = Math.max(0, MAX_DAILY_MORALE_PENALTY - usage.moralePenalty);
    const appliedPenalty = Math.min(potentialPenalty, remainingCap);
    usage.moralePenalty += appliedPenalty;
    moraleDelta -= appliedPenalty;
  }

  const hourOfDay = ((Math.trunc(simTimeHours) % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
  const wellbeingEffect = applyTraitEffects(
    employee,
    { fatigueDelta, moraleDelta },
    { taskDefinition: definition, hourOfDay, isBreakTask: isBreak },
  );

  const adjustedFatigue = wellbeingEffect.values.fatigueDelta ?? fatigueDelta;
  const adjustedMorale = wellbeingEffect.values.moraleDelta ?? moraleDelta;

  const nextMorale = clamp01(employee.morale01 + adjustedMorale);
  const nextFatigue = clamp01(Math.max(0, employee.fatigue01 + adjustedFatigue));

  if (nextMorale === employee.morale01 && nextFatigue === employee.fatigue01) {
    return { employee, fatigueDelta: adjustedFatigue, moraleDelta: adjustedMorale, breakdown: wellbeingEffect.breakdown };
  }

  return {
    employee: {
      ...employee,
      morale01: nextMorale,
      fatigue01: nextFatigue,
    } satisfies Employee,
    fatigueDelta: adjustedFatigue,
    moraleDelta: adjustedMorale,
    breakdown: wellbeingEffect.breakdown,
  };
}

function createSnapshot(
  simTimeHours: number,
  employees: readonly Employee[],
  queueDepth: number,
  maintenanceBacklog: number,
  tasksCompleted: number,
  baseMinutes: number,
  overtimeMinutes: number,
  waitTimes: readonly number[],
): WorkforceKpiSnapshot {
  const totalEmployees = employees.length;
  const moraleSum = employees.reduce((sum, emp) => sum + clamp01(emp.morale01), 0);
  const fatigueSum = employees.reduce((sum, emp) => sum + clamp01(emp.fatigue01), 0);
  const capacityMinutes = employees.reduce((sum, emp) => {
    const schedule = emp.schedule;
    const base = Math.max(0, schedule.hoursPerDay) * 60;
    const overtime = Math.max(0, schedule.overtimeHoursPerDay) * 60;
    return sum + base + overtime;
  }, 0);
  const utilisation = capacityMinutes > 0 ? clamp01((baseMinutes + overtimeMinutes) / capacityMinutes) : 0;
  const sortedWaits = [...waitTimes].sort((a, b) => a - b);
  const index = sortedWaits.length > 0 ? Math.max(0, Math.ceil(sortedWaits.length * 0.95) - 1) : 0;
  const p95Wait = sortedWaits.length > 0 ? sortedWaits[index] ?? 0 : 0;

  return {
    simTimeHours,
    tasksCompleted,
    queueDepth,
    laborHoursCommitted: baseMinutes / 60,
    overtimeHoursCommitted: overtimeMinutes / 60,
    overtimeMinutes,
    utilization01: utilisation,
    p95WaitTimeHours: p95Wait,
    maintenanceBacklog,
    averageMorale01: totalEmployees > 0 ? moraleSum / totalEmployees : 0,
    averageFatigue01: totalEmployees > 0 ? fatigueSum / totalEmployees : 0,
  } satisfies WorkforceKpiSnapshot;
}

function isZoneQuarantined(world: SimulationWorld, zoneId: Zone['id'], currentTick: number): boolean {
  const risks = world.health?.pestDisease.zoneRisks ?? [];
  const entry = risks.find((risk) => risk.zoneId === zoneId);
  const quarantineUntil = entry?.quarantineUntilTick;

  return typeof quarantineUntil === 'number' && quarantineUntil > currentTick;
}

export function applyWorkforce(world: SimulationWorld, ctx: EngineContext): SimulationWorld {
  const runtime = ensureWorkforceRuntime(ctx);
  let workforceState = (world as SimulationWorld & { workforce?: WorkforceState }).workforce;

  const currentSimHours = Number.isFinite(world.simTimeHours) ? world.simTimeHours : 0;
  const currentSimDay = Math.floor(currentSimHours / HOURS_PER_DAY);
  const cultivationRuntime = ensureCultivationTaskRuntime(ctx);
  const cultivationCatalog = getCultivationMethodCatalog();
  const cultivationTasks: WorkforceTaskInstance[] = [];
  const currentTick = Math.trunc(currentSimHours);

  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      for (const zone of room.zones) {
        const cultivationZoneTasks = scheduleCultivationTasksForZone({
          world,
          structure,
          room,
          zone,
          workforce: workforceState,
          runtime: cultivationRuntime,
          currentTick,
          methodCatalog: cultivationCatalog,
        });

        if (cultivationZoneTasks.length > 0) {
          cultivationTasks.push(...cultivationZoneTasks);
        }
      }
    }
  }

  if (cultivationTasks.length > 0) {
    if (!workforceState) {
      workforceState = {
        roles: [],
        employees: [],
        taskDefinitions: [],
        taskQueue: [],
        kpis: [],
        warnings: [],
        payroll: createEmptyPayrollState(currentSimDay),
        market: { structures: [] },
      } satisfies WorkforceState;
    }

    const existingTaskIds = new Set(workforceState.taskQueue.map((task) => task.id));
    const filteredCultivationTasks = cultivationTasks.filter((task) => !existingTaskIds.has(task.id));

    if (filteredCultivationTasks.length > 0) {
      workforceState = {
        ...workforceState,
        taskQueue: [...workforceState.taskQueue, ...filteredCultivationTasks],
      } satisfies WorkforceState;
    }
  }

  if (!workforceState) {
    runtime.kpiSnapshot = createSnapshot(world.simTimeHours, [], 0, 0, 0, 0, 0, []);
    clearWorkforcePayrollAccrual(ctx);
    return world;
  }

  const pestEvaluation = evaluatePestDiseaseSystem(world, currentSimHours);

  if (pestEvaluation.scheduledTasks.length > 0) {
    const existingTaskIds = new Set(workforceState.taskQueue.map((task) => task.id));
    const newTasks = pestEvaluation.scheduledTasks.filter((task) => !existingTaskIds.has(task.id));

    if (newTasks.length > 0) {
      workforceState = {
        ...workforceState,
        taskQueue: [...workforceState.taskQueue, ...newTasks],
      } satisfies WorkforceState;
    }
  }

  const shouldUpdateHealth = world.health !== pestEvaluation.health;
  const shouldUpdateWorkforce = (world as SimulationWorld & { workforce?: WorkforceState }).workforce !== workforceState;

  if (shouldUpdateHealth || shouldUpdateWorkforce) {
    world = {
      ...world,
      health: pestEvaluation.health,
      workforce: workforceState,
    } satisfies SimulationWorld;
  }

  emitPestDiseaseRiskWarnings(ctx.telemetry, pestEvaluation.warnings);
  emitPestDiseaseTaskEvents(ctx.telemetry, pestEvaluation.taskEvents);

  const workforceConfig = resolveWorkforceConfig(ctx);
  const intents = extractWorkforceIntents(ctx);
  let marketState: WorkforceMarketState = workforceState.market;
  const newEmployees: Employee[] = [];
  const pendingScanTelemetry: {
    readonly structureId: Structure['id'];
    readonly scanCounter: number;
    readonly poolSize: number;
  }[] = [];
  const pendingHireTelemetry: { readonly employeeId: Employee['id']; readonly structureId: Structure['id'] }[] = [];
  const raiseIntents: WorkforceRaiseIntent[] = [];
  const terminationIntents: WorkforceTerminationIntent[] = [];
  const worldSeed = world.seed;

  for (const intent of intents) {
    if (intent.type === 'hiring.market.scan') {
      const scanIntent = intent;
      const result = performMarketScan({
        market: marketState,
        config: workforceConfig.market,
        worldSeed,
        structureId: scanIntent.structureId,
        currentSimHours,
        roles: workforceState.roles,
      });

      marketState = result.market;

      if (result.didScan && result.pool) {
        const scanCounter = result.scanCounter ?? 0;
        recordWorkforceMarketCharge(ctx, {
          structureId: scanIntent.structureId,
          amountCc: workforceConfig.market.scanCost_cc,
          scanCounter,
        });
        pendingScanTelemetry.push({
          structureId: scanIntent.structureId,
          scanCounter,
          poolSize: result.pool.length,
        });
      }

      continue;
    }

    if (intent.type === 'hiring.market.hire') {
      const hireIntent = intent;
      const result = performMarketHire({
        market: marketState,
        structureId: hireIntent.candidate.structureId,
        candidateId: hireIntent.candidate.candidateId,
      });

      marketState = result.market;

      if (result.candidate) {
        const employee = createEmployeeFromCandidate(
          result.candidate,
          workforceState.roles,
          hireIntent.candidate.structureId,
          worldSeed,
          currentSimDay,
        );

        if (employee) {
          newEmployees.push(employee);
          pendingHireTelemetry.push({
            employeeId: employee.id,
            structureId: employee.assignedStructureId,
          });
        }
      }
    }

    if (
      intent.type === 'workforce.raise.accept' ||
      intent.type === 'workforce.raise.bonus' ||
      intent.type === 'workforce.raise.ignore'
    ) {
      raiseIntents.push(intent as WorkforceRaiseIntent);
      continue;
    }

    if (intent.type === 'workforce.employee.terminate') {
      terminationIntents.push(intent);
    }
  }

  const employeesAfterHire =
    newEmployees.length > 0
      ? [...workforceState.employees, ...newEmployees]
      : workforceState.employees;

  const employeeDirectory = new Map<Employee['id'], Employee>();
  for (const employee of employeesAfterHire) {
    employeeDirectory.set(employee.id, employee);
  }

  const pendingRaiseEvents: WorkforceRaiseTelemetryEvent[] = [];
  for (const raiseIntent of raiseIntents) {
    const employee = employeeDirectory.get(raiseIntent.employeeId);

    if (!employee) {
      continue;
    }

    const outcome = applyRaiseIntent({
      employee,
      intent: raiseIntent,
      currentSimDay,
    });

    if (!outcome) {
      continue;
    }

    employeeDirectory.set(employee.id, outcome.employee);

    pendingRaiseEvents.push({
      action: outcome.action,
      employeeId: employee.id,
      structureId: employee.assignedStructureId,
      simDay: currentSimDay,
      rateIncreaseFactor: outcome.rateIncreaseFactor,
      moraleDelta01: outcome.moraleDelta01,
      salaryExpectation_per_h: outcome.employee.salaryExpectation_per_h,
      bonusAmount_cc: outcome.bonusAmount_cc,
    });
  }

  const terminatedEmployeeIds = new Set<Employee['id']>();
  const pendingTerminationEvents: WorkforceTerminationTelemetryEvent[] = [];
  for (const terminationIntent of terminationIntents) {
    const employee = employeeDirectory.get(terminationIntent.employeeId);

    if (!employee) {
      continue;
    }

    employeeDirectory.delete(employee.id);
    terminatedEmployeeIds.add(employee.id);

    pendingTerminationEvents.push({
      employeeId: employee.id,
      structureId: employee.assignedStructureId,
      simDay: currentSimDay,
      reasonSlug: terminationIntent.reasonSlug,
      severanceCc: terminationIntent.severanceCc,
    });

    const ripple = terminationIntent.moraleRipple01 ?? -0.02;

    if (ripple !== 0) {
      for (const [otherId, otherEmployee] of employeeDirectory.entries()) {
        if (otherEmployee.assignedStructureId !== employee.assignedStructureId || otherId === employee.id) {
          continue;
        }

        const adjustedMorale = clamp01(otherEmployee.morale01 + ripple);
        if (adjustedMorale !== otherEmployee.morale01) {
          employeeDirectory.set(otherId, { ...otherEmployee, morale01: adjustedMorale } satisfies Employee);
        }
      }
    }
  }

  const employeesAfterHrEvents = employeesAfterHire
    .map((employee) => employeeDirectory.get(employee.id))
    .filter((employee): employee is Employee => Boolean(employee));

  workforceState = {
    ...workforceState,
    employees: employeesAfterHrEvents,
    market: marketState,
  } satisfies WorkforceState;

  let taskQueue = workforceState.taskQueue;

  if (terminatedEmployeeIds.size > 0) {
    taskQueue = workforceState.taskQueue.map((task) => {
      if (!task.assignedEmployeeId || !terminatedEmployeeIds.has(task.assignedEmployeeId)) {
        return task;
      }

      return {
        ...task,
        status: task.status === 'completed' ? task.status : 'queued',
        assignedEmployeeId: undefined,
      } satisfies WorkforceTaskInstance;
    });
  }

  const roleById = new Map<EmployeeRole['id'], EmployeeRole>();
  for (const role of workforceState.roles) {
    roleById.set(role.id, role);
  }

  const lookups = resolveStructureLookups(world);
  const companyLocation = world.company.location;
  const locationIndexTable = resolveLocationIndexTable(ctx);
  const definitions = new Map<WorkforceTaskDefinition['taskCode'], WorkforceTaskDefinition>(
    workforceState.taskDefinitions.map((definition) => [definition.taskCode, definition]),
  );
  const structureIndexLookup = new Map<Structure['id'], number>();
  const structureById = new Map<Structure['id'], Structure>();
  world.company.structures.forEach((structure, index) => {
    structureIndexLookup.set(structure.id, index);
    structureById.set(structure.id, structure);
  });

  const maintenanceRuntime = consumeDeviceMaintenanceRuntime(ctx);
  const maintenanceWarnings: WorkforceWarning[] = [];

  if (maintenanceRuntime) {
    const maintainDefinition = definitions.get('maintain_device');
    const existingTaskIds = new Set(taskQueue.map((task) => task.id));

    if (maintenanceRuntime.scheduledTasks.length > 0 && !maintainDefinition) {
      maintenanceWarnings.push({
        simTimeHours: world.simTimeHours,
        code: 'workforce.maintenance.definition_missing',
        message: 'Maintenance tasks could not be scheduled because the maintain_device definition is missing.',
        severity: 'warning',
      });
    }

    if (maintainDefinition) {
      for (const plan of maintenanceRuntime.scheduledTasks) {
        if (!plan.workshopRoomId) {
          maintenanceWarnings.push({
            simTimeHours: world.simTimeHours,
            code: 'workforce.maintenance.workshop_missing',
            message: `Maintenance task for ${plan.deviceName} skipped because no workshop is available in structure ${plan.structureName}.`,
            severity: 'warning',
            structureId: plan.structureId,
            metadata: { deviceId: plan.deviceId, zoneId: plan.zoneId },
          });
          continue;
        }

        if (existingTaskIds.has(plan.taskId)) {
          continue;
        }

        const newTask: WorkforceTaskInstance = {
          id: plan.taskId,
          taskCode: maintainDefinition.taskCode,
          status: 'queued',
          createdAtTick: plan.startTick,
          dueTick: plan.dueTick,
          context: {
            taskCategory: 'maintenance',
            reason: plan.reason,
            deviceId: plan.deviceId,
            structureId: plan.structureId,
            roomId: plan.roomId,
            zoneId: plan.zoneId,
            workshopRoomId: plan.workshopRoomId,
          },
        } satisfies WorkforceTaskInstance;

        taskQueue = [...taskQueue, newTask];
        existingTaskIds.add(plan.taskId);

        ctx.telemetry?.emit(TELEMETRY_DEVICE_MAINTENANCE_SCHEDULED_V1, {
          taskId: plan.taskId,
          deviceId: plan.deviceId,
          structureId: plan.structureId,
          roomId: plan.roomId,
          zoneId: plan.zoneId,
          startTick: plan.startTick,
          endTick: plan.endTick,
          serviceHours: plan.serviceHours,
          reason: plan.reason,
          serviceVisitCostCc: plan.serviceVisitCostCc,
        });
      }
    }

    if (maintenanceRuntime.completedTasks.length > 0) {
      const completedIds = new Set(maintenanceRuntime.completedTasks.map((entry) => entry.taskId));
      taskQueue = taskQueue.map((task) => {
        if (!completedIds.has(task.id)) {
          return task;
        }

        if (task.status === 'completed') {
          return task;
        }

        return {
          ...task,
          status: 'completed',
        } satisfies WorkforceTaskInstance;
      });
    }

    if (maintenanceRuntime.replacements.length > 0) {
      for (const recommendation of maintenanceRuntime.replacements) {
        ctx.telemetry?.emit(TELEMETRY_DEVICE_REPLACEMENT_RECOMMENDED_V1, {
          deviceId: recommendation.deviceId,
          structureId: recommendation.structureId,
          roomId: recommendation.roomId,
          zoneId: recommendation.zoneId,
          recommendedSinceTick: recommendation.recommendedSinceTick,
          totalMaintenanceCostCc: recommendation.totalMaintenanceCostCc,
          replacementCostCc: recommendation.replacementCostCc,
        });

        maintenanceWarnings.push({
          simTimeHours: world.simTimeHours,
          code: 'workforce.maintenance.replacement_recommended',
          message: `Replacement recommended for ${recommendation.deviceName} in ${recommendation.zoneName}.`,
          severity: 'warning',
          structureId: recommendation.structureId,
          metadata: {
            deviceId: recommendation.deviceId,
            totalMaintenanceCostCc: recommendation.totalMaintenanceCostCc,
            replacementCostCc: recommendation.replacementCostCc,
          },
        });
      }
    }
  }

  const previousPayroll = workforceState.payroll ?? createEmptyPayrollState(currentSimDay);
  let payrollDayIndex = previousPayroll.dayIndex;
  let payrollTotals = clonePayrollTotals(previousPayroll.totals);
  let structurePayroll = cloneStructurePayroll(previousPayroll.byStructure);
  let finalizedPayroll: WorkforcePayrollState | undefined;

  if (previousPayroll.dayIndex !== currentSimDay) {
    finalizedPayroll = finalizePayrollState(previousPayroll);
    payrollDayIndex = currentSimDay;
    payrollTotals = createEmptyPayrollTotals();
    structurePayroll = new Map<Structure['id'], WorkforceStructurePayrollTotals>();
  }

  const employeeUsage = new Map<Employee['id'], EmployeeUsage>();
  const updatedEmployees = new Map<Employee['id'], Employee>();
  const assignments: WorkforceAssignment[] = [];
  const waitTimes: number[] = [];
  const employeesByStructure = new Map<Structure['id'], Employee[]>();
  for (const employee of workforceState.employees) {
    const list = employeesByStructure.get(employee.assignedStructureId) ?? [];
    list.push(employee);
    employeesByStructure.set(employee.assignedStructureId, list);
  }

  interface SchedulingEntry {
    readonly task: WorkforceTaskInstance;
    readonly definition: WorkforceTaskDefinition;
    readonly structureId: Structure['id'];
    readonly queueIndex: number;
  }

  const schedulingEntries: SchedulingEntry[] = [];

  taskQueue.forEach((task, index) => {
    if (task.status !== 'queued') {
      return;
    }

    const definition = definitions.get(task.taskCode);

    if (!definition) {
      return;
    }

    const structureId = resolveStructureId(task, lookups);

    if (!structureId) {
      return;
    }

    schedulingEntries.push({
      task,
      definition,
      structureId,
      queueIndex: index,
    });
  });

  schedulingEntries.sort((a, b) => {
    if (b.definition.priority !== a.definition.priority) {
      return b.definition.priority - a.definition.priority;
    }

    if (a.task.createdAtTick !== b.task.createdAtTick) {
      return a.task.createdAtTick - b.task.createdAtTick;
    }

    return a.queueIndex - b.queueIndex;
  });

  let totalBaseMinutes = 0;
  let totalOvertimeMinutes = 0;
  let tasksCompleted = 0;

  const taskUpdates = new Map<WorkforceTaskInstance['id'], WorkforceTaskInstance>();

  for (const entry of schedulingEntries) {
    const { task, definition, structureId } = entry;
    
    const zoneId = task.context?.zoneId as string | undefined;
    if (zoneId) {
      if (isZoneQuarantined(world, zoneId, world.simTimeHours)) {
        continue;
      }
    }

    const employees = employeesByStructure.get(structureId) ?? [];

    if (employees.length === 0) {
      continue;
    }

    const demandMinutes = resolveTaskDemandMinutes(task, definition);
    const requiredRole = definition.requiredRoleSlug;

    const candidateEvaluations: CandidateEvaluation[] = [];

    for (const employee of employees) {
      const slug = resolveRoleSlug(employee.roleId, workforceState.roles);

      if (slug !== requiredRole) {
        continue;
      }

      const usage = ensureUsage(employeeUsage, employee.id);
      const evaluation = evaluateCandidate(
        employee,
        definition,
        demandMinutes,
        usage,
        world.simTimeHours,
      );

      if (!evaluation) {
        continue;
      }

      candidateEvaluations.push(evaluation);
    }

    if (candidateEvaluations.length === 0) {
      continue;
    }

    const structureIndex = structureIndexLookup.get(structureId) ?? 0;
    const selected = selectCandidate(candidateEvaluations, structureIndex, world.simTimeHours);
    const usage = ensureUsage(employeeUsage, selected.employee.id);
    usage.baseMinutes += selected.baseMinutes;
    usage.overtimeMinutes += selected.overtimeMinutes;

    const adjustment = applyEmployeeAdjustments(
      updatedEmployees.get(selected.employee.id) ?? selected.employee,
      usage,
      selected,
      task,
      definition,
      world.simTimeHours,
    );
    const totalMinutesWorked = selected.baseMinutes + selected.overtimeMinutes;
    const updatedExperience = accrueExperience(
      adjustment.employee.experience,
      totalMinutesWorked,
      selected.taskEffects.xpRateMultiplier,
    );
    const experiencedEmployee =
      updatedExperience === adjustment.employee.experience
        ? adjustment.employee
        : {
            ...adjustment.employee,
            experience: updatedExperience,
          } satisfies Employee;
    updatedEmployees.set(selected.employee.id, experiencedEmployee);

    const waitTimeHours = Math.max(0, world.simTimeHours - task.createdAtTick);
    assignments.push({
      taskId: task.id,
      employeeId: selected.employee.id,
      baseMinutes: selected.baseMinutes,
      overtimeMinutes: selected.overtimeMinutes,
      waitTimeHours,
      structureId,
      taskEffects: {
        durationMinutes: selected.taskEffects.durationMinutes,
        errorRate01: selected.taskEffects.errorRate01,
        deviceWearMultiplier: selected.taskEffects.deviceWearMultiplier,
        xpRateMultiplier: selected.taskEffects.xpRateMultiplier,
        breakdown: selected.taskEffects.breakdown,
      },
      wellbeingEffects: {
        fatigueDelta: adjustment.fatigueDelta,
        moraleDelta: adjustment.moraleDelta,
        breakdown: adjustment.breakdown,
      },
    });
    waitTimes.push(waitTimeHours);

    totalBaseMinutes += selected.baseMinutes;
    totalOvertimeMinutes += selected.overtimeMinutes;
    tasksCompleted += 1;

    const structure = structureById.get(structureId);
    const structureLocation = resolveStructureLocation(structure, companyLocation);
    const locationIndex = resolveLocationIndex(locationIndexTable, structureLocation);
    const role = roleById.get(selected.employee.roleId);
    const contribution = computePayrollContribution(
      selected.employee,
      role,
      definition,
      selected.baseMinutes,
      selected.overtimeMinutes,
      locationIndex,
    );
    applyPayrollContribution(payrollTotals, contribution);
    const structureTotals = ensureStructurePayroll(structurePayroll, structureId);
    applyPayrollContribution(structureTotals, contribution);

    taskUpdates.set(task.id, {
      ...task,
      status: 'completed',
      assignedEmployeeId: selected.employee.id,
    });
  }

  const nextEmployees = workforceState.employees.map(
    (employee) => updatedEmployees.get(employee.id) ?? employee,
  );
  const updatedTasks = taskQueue.map((task) => taskUpdates.get(task.id) ?? task);
  const queueDepth = updatedTasks.reduce(
    (count, item) => (item.status === 'queued' ? count + 1 : count),
    0,
  );
  const maintenanceBacklog = updatedTasks.reduce(
    (count, item) => (item.status === 'queued' && isMaintenanceTask(item) ? count + 1 : count),
    0,
  );

  payrollTotals.totalLaborCost = payrollTotals.baseCost + payrollTotals.otCost;
  const currentPayrollState: WorkforcePayrollState = {
    dayIndex: payrollDayIndex,
    totals: { ...payrollTotals },
    byStructure: materializeStructurePayroll(structurePayroll),
  } satisfies WorkforcePayrollState;

  setWorkforcePayrollAccrual(ctx, {
    current: currentPayrollState,
    finalized: finalizedPayroll,
  });

  const snapshot = createSnapshot(
    world.simTimeHours,
    nextEmployees,
    queueDepth,
    maintenanceBacklog,
    tasksCompleted,
    totalBaseMinutes,
    totalOvertimeMinutes,
    waitTimes,
  );

  runtime.assignments.push(...assignments);
  runtime.kpiSnapshot = snapshot;

  const combinedWarnings =
    maintenanceWarnings.length > 0
      ? [...workforceState.warnings, ...maintenanceWarnings]
      : workforceState.warnings;

  const nextWorkforce: WorkforceState = {
    ...workforceState,
    employees: nextEmployees,
    taskQueue: updatedTasks,
    kpis: [...workforceState.kpis, snapshot],
    warnings: combinedWarnings,
    payroll: currentPayrollState,
  } satisfies WorkforceState;

  emitWorkforceKpiSnapshot(ctx.telemetry, snapshot);
  emitWorkforcePayrollSnapshot(ctx.telemetry, currentPayrollState);

  if (combinedWarnings.length > 0) {
    emitWorkforceWarnings(ctx.telemetry, combinedWarnings);
  }

  for (const event of pendingScanTelemetry) {
    emitHiringMarketScanCompleted(ctx.telemetry, {
      structureId: event.structureId,
      simDay: currentSimDay,
      scanCounter: event.scanCounter,
      poolSize: event.poolSize,
      cost_cc: workforceConfig.market.scanCost_cc,
    });
  }

  for (const hireEvent of pendingHireTelemetry) {
    emitHiringEmployeeOnboarded(ctx.telemetry, hireEvent);
  }

  for (const raiseEvent of pendingRaiseEvents) {
    emitWorkforceRaiseEvent(ctx.telemetry, raiseEvent);
  }

  for (const terminationEvent of pendingTerminationEvents) {
    emitWorkforceTermination(ctx.telemetry, terminationEvent);
  }

  return {
    ...world,
    workforce: nextWorkforce,
  } satisfies SimulationWorld;
}