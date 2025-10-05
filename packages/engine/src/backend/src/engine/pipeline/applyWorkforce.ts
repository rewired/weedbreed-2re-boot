import { HOURS_PER_DAY } from '../../constants/simConstants.js';
import { bankersRound, clamp01 } from '../../util/math.js';
import type {
  CompanyLocation,
  Employee,
  EmployeeRole,
  Room,
  SimulationWorld,
  Structure,
  WorkforceKpiSnapshot,
  WorkforcePayrollState,
  WorkforceStructurePayrollTotals,
  WorkforceState,
  WorkforceTaskDefinition,
  WorkforceTaskInstance,
  Zone,
} from '../../domain/world.js';
import {
  createEmptyLocationIndexTable,
  resolveLocationIndex,
  type LocationIndexTable,
} from '../../domain/payroll/locationIndex.js';
import type { EngineRunContext as EngineContext } from '../Engine.js';

const SCORE_EPSILON = 1e-6;
const OVERTIME_MORALE_PENALTY_PER_HOUR = 0.02;
const MAX_DAILY_MORALE_PENALTY = 0.1;
const FATIGUE_GAIN_PER_HOUR = 0.01;
const BREAKROOM_FATIGUE_RECOVERY_PER_HALF_HOUR = 0.02;
const BASE_WAGE_PER_HOUR = 5;
const SKILL_WAGE_RATE_PER_POINT = 10;
const OVERTIME_RATE_MULTIPLIER = 1.25;

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
}

export interface WorkforceRuntime {
  readonly assignments: readonly WorkforceAssignment[];
  readonly kpiSnapshot?: WorkforceKpiSnapshot;
}

type WorkforceRuntimeMutable = {
  assignments: WorkforceAssignment[];
  kpiSnapshot?: WorkforceKpiSnapshot;
};

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

interface CandidateEvaluation {
  employee: Employee;
  score: number;
  baseMinutes: number;
  overtimeMinutes: number;
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

type PayrollAccumulator = {
  baseMinutes: number;
  otMinutes: number;
  baseCost: number;
  otCost: number;
  totalLaborCost: number;
};

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
  const baseRatePerHour = (BASE_WAGE_PER_HOUR + SKILL_WAGE_RATE_PER_POINT * skillLevel) * normalizedIndex;
  const baseCost = (baseRatePerHour / 60) * base;
  const overtimeCost = ((baseRatePerHour * OVERTIME_RATE_MULTIPLIER) / 60) * overtime;

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

  if (candidate && candidate.cityName && candidate.countryName) {
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
  const context = (task.context ?? {}) as Record<string, unknown>;
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
  const context = (task.context ?? {}) as Record<string, unknown>;

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
): CandidateEvaluation | null {
  const { valid, score: skillScore } = computeSkillScore(employee, definition);

  if (!valid) {
    return null;
  }

  const schedule = employee.schedule;
  const baseCapacity = Math.max(0, schedule.hoursPerDay) * 60;
  const overtimeCapacity = Math.max(0, schedule.overtimeHoursPerDay) * 60;
  const totalCapacity = baseCapacity + overtimeCapacity;

  if (totalCapacity <= 0) {
    return null;
  }

  const remainingBase = Math.max(0, baseCapacity - usage.baseMinutes);
  const baseMinutes = Math.min(remainingBase, demandMinutes);
  const remainingDemand = demandMinutes - baseMinutes;
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
  return ordered[index] as CandidateEvaluation;
}

function isBreakroomTask(task: WorkforceTaskInstance): boolean {
  const context = (task.context ?? {}) as Record<string, unknown>;
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

  const context = (task.context ?? {}) as Record<string, unknown>;
  const category = String(context.taskCategory ?? context.category ?? '').toLowerCase();
  return category === 'maintenance';
}

function applyEmployeeAdjustments(
  employee: Employee,
  usage: EmployeeUsage,
  evaluation: CandidateEvaluation,
  task: WorkforceTaskInstance,
): Employee {
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

  const nextMorale = clamp01(employee.morale01 + moraleDelta);
  const nextFatigue = clamp01(Math.max(0, employee.fatigue01 + fatigueDelta));

  if (nextMorale === employee.morale01 && nextFatigue === employee.fatigue01) {
    return employee;
  }

  return {
    ...employee,
    morale01: nextMorale,
    fatigue01: nextFatigue,
  } satisfies Employee;
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

export function applyWorkforce(world: SimulationWorld, ctx: EngineContext): SimulationWorld {
  const runtime = ensureWorkforceRuntime(ctx);
  const workforceState = (world as SimulationWorld & { workforce?: WorkforceState }).workforce;

  if (!workforceState) {
    runtime.kpiSnapshot = createSnapshot(world.simTimeHours, [], 0, 0, 0, 0, 0, []);
    clearWorkforcePayrollAccrual(ctx);
    return world;
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

  const currentDayIndex = Math.max(0, Math.trunc(world.simTimeHours / HOURS_PER_DAY));
  const previousPayroll = workforceState.payroll ?? createEmptyPayrollState(currentDayIndex);
  let payrollDayIndex = previousPayroll.dayIndex;
  let payrollTotals = clonePayrollTotals(previousPayroll.totals);
  let structurePayroll = cloneStructurePayroll(previousPayroll.byStructure);
  let finalizedPayroll: WorkforcePayrollState | undefined;

  if (previousPayroll.dayIndex !== currentDayIndex) {
    finalizedPayroll = finalizePayrollState(previousPayroll);
    payrollDayIndex = currentDayIndex;
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

  workforceState.taskQueue.forEach((task, index) => {
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
      const evaluation = evaluateCandidate(employee, definition, demandMinutes, usage);

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

    const nextEmployee = applyEmployeeAdjustments(
      updatedEmployees.get(selected.employee.id) ?? selected.employee,
      usage,
      selected,
      task,
    );
    updatedEmployees.set(selected.employee.id, nextEmployee);

    const waitTimeHours = Math.max(0, world.simTimeHours - task.createdAtTick);
    assignments.push({
      taskId: task.id,
      employeeId: selected.employee.id,
      baseMinutes: selected.baseMinutes,
      overtimeMinutes: selected.overtimeMinutes,
      waitTimeHours,
      structureId,
    });
    waitTimes.push(waitTimeHours);

    totalBaseMinutes += selected.baseMinutes;
    totalOvertimeMinutes += selected.overtimeMinutes;
    tasksCompleted += 1;

    const structure = structureById.get(structureId);
    const structureLocation = resolveStructureLocation(structure, companyLocation);
    const locationIndex = resolveLocationIndex(locationIndexTable, structureLocation);
    const contribution = computePayrollContribution(
      selected.employee,
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
  const updatedTasks = workforceState.taskQueue.map((task) => taskUpdates.get(task.id) ?? task);
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

  const nextWorkforce: WorkforceState = {
    ...workforceState,
    employees: nextEmployees,
    taskQueue: updatedTasks,
    kpis: [...workforceState.kpis, snapshot],
    payroll: currentPayrollState,
  } satisfies WorkforceState;

  return {
    ...world,
    workforce: nextWorkforce,
  } satisfies SimulationWorld;
}
