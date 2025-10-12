import { FLOAT_TOLERANCE } from '@/backend/src/constants/simConstants';
import type {
  Employee,
  EmployeeRole,
  Structure,
  WorkforceTaskDefinition,
  WorkforceTaskInstance,
  Zone,
} from '../../domain/world.ts';
import { clamp01 } from '../../util/math.ts';
import {
  accrueExperience,
  evaluateTaskTraitEffects,
  evaluateWellbeingTraitEffects,
} from '../traits/effects.ts';
import type { WorkforceAssignment } from '../types.ts';

const SCORE_EPSILON = FLOAT_TOLERANCE;
/* eslint-disable @typescript-eslint/no-magic-numbers -- Neutral skill average uses canonical midpoint */
const DEFAULT_SKILL_AVERAGE01 = 0.5 as const;
/* eslint-enable @typescript-eslint/no-magic-numbers */

interface EmployeeUsage {
  baseMinutes: number;
  overtimeMinutes: number;
  moralePenalty: number;
}

export interface ContributionDraft {
  readonly employee: Employee;
  readonly roleId: EmployeeRole['id'];
  readonly definition: WorkforceTaskDefinition;
  readonly structureId: Structure['id'];
  readonly baseMinutes: number;
  readonly overtimeMinutes: number;
}

export interface DispatchOutcome {
  readonly assignments: readonly WorkforceAssignment[];
  readonly updatedEmployees: ReadonlyMap<Employee['id'], Employee>;
  readonly taskUpdates: ReadonlyMap<WorkforceTaskInstance['id'], WorkforceTaskInstance>;
  readonly waitTimes: readonly number[];
  readonly tasksCompleted: number;
  readonly totalBaseMinutes: number;
  readonly totalOvertimeMinutes: number;
  readonly contributions: readonly ContributionDraft[];
}

export interface DispatchContext {
  readonly simTimeHours: number;
  readonly structureIndexLookup: ReadonlyMap<Structure['id'], number>;
  readonly roleById: ReadonlyMap<EmployeeRole['id'], EmployeeRole>;
  readonly isZoneQuarantined: (zoneId: Zone['id']) => boolean;
}

interface SchedulingEntry {
  readonly task: WorkforceTaskInstance;
  readonly definition: WorkforceTaskDefinition;
  readonly structureId: Structure['id'];
  readonly queueIndex: number;
}

function ensureUsage(map: Map<Employee['id'], EmployeeUsage>, employeeId: Employee['id']): EmployeeUsage {
  const existing = map.get(employeeId);

  if (existing) {
    return existing;
  }

  const created: EmployeeUsage = { baseMinutes: 0, overtimeMinutes: 0, moralePenalty: 0 };
  map.set(employeeId, created);
  return created;
}

function resolveStructureId(
  task: WorkforceTaskInstance,
  lookups: {
    readonly roomToStructure: ReadonlyMap<string, Structure['id']>;
    readonly zoneToStructure: ReadonlyMap<string, Structure['id']>;
  },
): Structure['id'] | null {
  const context = task.context ?? {};
  const explicit = typeof context.structureId === 'string' ? (context.structureId as Structure['id']) : null;

  if (explicit) {
    return explicit;
  }

  const roomId = typeof context.roomId === 'string' ? (context.roomId) : null;

  if (roomId) {
    const structureId = lookups.roomToStructure.get(roomId);
    if (structureId) {
      return structureId;
    }
  }

  const zoneId = typeof context.zoneId === 'string' ? (context.zoneId) : null;

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
  const laborMinutes = definition.costModel.laborMinutes;
  const baseMinutes = Math.max(0, Number.isFinite(laborMinutes) ? laborMinutes : 0);
  const context = task.context ?? {};

  if (baseMinutes <= 0) {
    return 0;
  }

  switch (definition.costModel.basis) {
    case 'perPlant': {
      const plantCountRaw = context.plantCount ?? context.plants ?? 1;
      const plantCount =
        typeof plantCountRaw === 'number' && Number.isFinite(plantCountRaw) && plantCountRaw > 0
          ? plantCountRaw
          : 1;
      return baseMinutes * plantCount;
    }
    case 'perSquareMeter': {
      const areaRaw = context.area_m2 ?? context.squareMeters ?? context.area ?? 1;
      const area =
        typeof areaRaw === 'number' && Number.isFinite(areaRaw) && areaRaw > 0 ? areaRaw : 1;
      return baseMinutes * area;
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
    const average =
      employee.skills.length > 0 ? aggregated / employee.skills.length : DEFAULT_SKILL_AVERAGE01;
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
): {
  readonly employee: Employee;
  readonly score: number;
  readonly baseMinutes: number;
  readonly overtimeMinutes: number;
  readonly traits: ReturnType<typeof evaluateTaskTraitEffects>;
} | null {
  const { valid, score: skillScore } = computeSkillScore(employee, definition);

  if (!valid) {
    return null;
  }

  const traitEffects = evaluateTaskTraitEffects(employee, definition, demandMinutes, simTimeHours);
  const effectiveDemand = traitEffects.durationMinutes;
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
    traits: traitEffects,
  };
}

function selectCandidate(
  candidates: readonly NonNullable<ReturnType<typeof evaluateCandidate>>[],
  structureIndex: number,
  simTimeHours: number,
): NonNullable<ReturnType<typeof evaluateCandidate>> {
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

export function buildSchedulingEntries(
  taskQueue: readonly WorkforceTaskInstance[],
  definitions: ReadonlyMap<WorkforceTaskDefinition['taskCode'], WorkforceTaskDefinition>,
  lookups: {
    readonly roomToStructure: ReadonlyMap<string, Structure['id']>;
    readonly zoneToStructure: ReadonlyMap<string, Structure['id']>;
  },
): SchedulingEntry[] {
  const entries: SchedulingEntry[] = [];

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

    entries.push({ task, definition, structureId, queueIndex: index });
  });

  entries.sort((a, b) => {
    if (b.definition.priority !== a.definition.priority) {
      return b.definition.priority - a.definition.priority;
    }

    if (a.task.createdAtTick !== b.task.createdAtTick) {
      return a.task.createdAtTick - b.task.createdAtTick;
    }

    return a.queueIndex - b.queueIndex;
  });

  return entries;
}

export function dispatchTasks(
  entries: readonly SchedulingEntry[],
  context: DispatchContext,
  employeesByStructure: ReadonlyMap<Structure['id'], readonly Employee[]>,
): DispatchOutcome {
  const usage = new Map<Employee['id'], EmployeeUsage>();
  const updatedEmployees = new Map<Employee['id'], Employee>();
  const taskUpdates = new Map<WorkforceTaskInstance['id'], WorkforceTaskInstance>();
  const assignments: WorkforceAssignment[] = [];
  const waitTimes: number[] = [];
  const contributions: ContributionDraft[] = [];
  let tasksCompleted = 0;
  let totalBaseMinutes = 0;
  let totalOvertimeMinutes = 0;

  for (const entry of entries) {
    const { task, definition, structureId } = entry;
    const zoneId = (task.context?.zoneId ?? null) as Zone['id'] | null;

    if (zoneId && context.isZoneQuarantined(zoneId)) {
      continue;
    }

    const employees = employeesByStructure.get(structureId) ?? [];

    if (employees.length === 0) {
      continue;
    }

    const demandMinutes = resolveTaskDemandMinutes(task, definition);
    const requiredRole = definition.requiredRoleSlug;
    const candidateEvaluations: NonNullable<ReturnType<typeof evaluateCandidate>>[] = [];

    for (const employee of employees) {
      if (requiredRole && context.roleById.get(employee.roleId)?.slug !== requiredRole) {
        continue;
      }

      const entryUsage = ensureUsage(usage, employee.id);
      const evaluation = evaluateCandidate(
        updatedEmployees.get(employee.id) ?? employee,
        definition,
        demandMinutes,
        entryUsage,
        context.simTimeHours,
      );

      if (!evaluation) {
        continue;
      }

      candidateEvaluations.push(evaluation);
    }

    if (candidateEvaluations.length === 0) {
      continue;
    }

    const structureIndex = context.structureIndexLookup.get(structureId) ?? 0;
    const selected = selectCandidate(candidateEvaluations, structureIndex, context.simTimeHours);
    const entryUsage = ensureUsage(usage, selected.employee.id);
    entryUsage.baseMinutes += selected.baseMinutes;
    entryUsage.overtimeMinutes += selected.overtimeMinutes;

    const wellbeing = evaluateWellbeingTraitEffects(
      updatedEmployees.get(selected.employee.id) ?? selected.employee,
      entryUsage,
      selected,
      task,
      definition,
      context.simTimeHours,
    );
    const totalMinutesWorked = selected.baseMinutes + selected.overtimeMinutes;
    const experience = accrueExperience(
      wellbeing.employee.experience,
      totalMinutesWorked,
      selected.traits.xpRateMultiplier,
    );
    const experiencedEmployee =
      experience === wellbeing.employee.experience
        ? wellbeing.employee
        : { ...wellbeing.employee, experience } satisfies Employee;
    updatedEmployees.set(selected.employee.id, experiencedEmployee);

    const waitTimeHours = Math.max(0, context.simTimeHours - task.createdAtTick);
    assignments.push({
      taskId: task.id,
      employeeId: selected.employee.id,
      baseMinutes: selected.baseMinutes,
      overtimeMinutes: selected.overtimeMinutes,
      waitTimeHours,
      structureId,
      taskEffects: {
        durationMinutes: selected.traits.durationMinutes,
        errorRate01: selected.traits.errorRate01,
        deviceWearMultiplier: selected.traits.deviceWearMultiplier,
        xpRateMultiplier: selected.traits.xpRateMultiplier,
        breakdown: selected.traits.breakdown,
      },
      wellbeingEffects: {
        fatigueDelta: wellbeing.fatigueDelta,
        moraleDelta: wellbeing.moraleDelta,
        breakdown: wellbeing.breakdown,
      },
    });
    waitTimes.push(waitTimeHours);

    totalBaseMinutes += selected.baseMinutes;
    totalOvertimeMinutes += selected.overtimeMinutes;
    tasksCompleted += 1;

    contributions.push({
      employee: selected.employee,
      roleId: selected.employee.roleId,
      definition,
      structureId,
      baseMinutes: selected.baseMinutes,
      overtimeMinutes: selected.overtimeMinutes,
    });

    taskUpdates.set(task.id, {
      ...task,
      status: 'completed',
      assignedEmployeeId: selected.employee.id,
    });
  }

  return {
    assignments,
    updatedEmployees,
    taskUpdates,
    waitTimes,
    tasksCompleted,
    totalBaseMinutes,
    totalOvertimeMinutes,
    contributions,
  };
}

export function groupEmployeesByStructure(
  employees: readonly Employee[],
): Map<Structure['id'], Employee[]> {
  const map = new Map<Structure['id'], Employee[]>();

  for (const employee of employees) {
    const list = map.get(employee.assignedStructureId) ?? [];
    list.push(employee);
    map.set(employee.assignedStructureId, list);
  }

  return map;
}

export function isMaintenanceTask(task: WorkforceTaskInstance): boolean {
  const lowered = task.taskCode.toLowerCase();

  if (lowered.includes('maint')) {
    return true;
  }

  const context = task.context ?? {};
  const rawCategory = context.taskCategory ?? context.category;
  const category = typeof rawCategory === 'string' ? rawCategory.toLowerCase() : '';
  return category === 'maintenance';
}

export interface StructureLookups {
  readonly roomToStructure: Map<string, Structure['id']>;
  readonly zoneToStructure: Map<string, Structure['id']>;
}

export function resolveStructureLookups(worldStructures: readonly Structure[]): StructureLookups {
  const roomToStructure = new Map<string, Structure['id']>();
  const zoneToStructure = new Map<string, Structure['id']>();

  for (const structure of worldStructures) {
    for (const room of structure.rooms) {
      roomToStructure.set(room.id, structure.id);

      for (const zone of room.zones) {
        zoneToStructure.set(zone.id, structure.id);
      }
    }
  }

  return { roomToStructure, zoneToStructure };
}
