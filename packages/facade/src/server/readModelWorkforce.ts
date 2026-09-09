/* eslint-disable wb-sim/no-ts-import-js-extension */
import type { SimulationWorld, WorkforceWarning } from '@wb/engine';
import { HOURS_PER_DAY } from '@engine/constants/time.js';
import { WORKFORCE_VIEW_SCHEMA_VERSION, type WorkforceViewReadModel } from '../readModels/api/schemas.js';
import { asReadModelUuid, clampFraction, roundTo, type WorkforceEmployee, type WorkforceTaskInstance } from './readModelShared.js';

function mapWorkforceWarning(
  warning: WorkforceWarning,
  employeeStructureIndex: ReadonlyMap<string, string | undefined>,
  taskIndex: ReadonlyMap<WorkforceTaskInstance['id'], WorkforceTaskInstance>
) {
  let employeeId = typeof warning.employeeId === 'string' ? warning.employeeId : undefined;

  if (!employeeId && typeof warning.taskId === 'string') {
    const task = taskIndex.get(warning.taskId);
    if (task?.assignedEmployeeId) {
      employeeId = task.assignedEmployeeId;
    }
  }

  let resolvedStructureId =
    warning.structureId ??
    (employeeId ? employeeStructureIndex.get(employeeId) ?? undefined : undefined) ??
    (typeof warning.employeeId === 'string'
      ? employeeStructureIndex.get(warning.employeeId) ?? undefined
      : undefined);

  if (!resolvedStructureId) {
    let uniqueStructure: string | null = null;
    for (const candidateStructureId of employeeStructureIndex.values()) {
      if (!candidateStructureId) {
        continue;
      }
      if (uniqueStructure === null) {
        uniqueStructure = candidateStructureId;
        continue;
      }
      if (uniqueStructure !== candidateStructureId) {
        uniqueStructure = null;
        break;
      }
    }
    if (uniqueStructure) {
      resolvedStructureId = uniqueStructure;
    }
  }

  if (!employeeId && resolvedStructureId) {
    let matchedEmployee: string | null = null;
    for (const [candidateEmployeeId, candidateStructureId] of employeeStructureIndex.entries()) {
      if (candidateStructureId === resolvedStructureId) {
        if (matchedEmployee !== null) {
          matchedEmployee = null;
          break;
        }
        matchedEmployee = candidateEmployeeId;
      }
    }
    if (matchedEmployee) {
      employeeId = asReadModelUuid(matchedEmployee);
    }
  }

  return {
    code: warning.code,
    message: warning.message,
    severity: warning.severity,
    structureId: resolvedStructureId ? asReadModelUuid(resolvedStructureId) : undefined,
    employeeId,
    taskId: warning.taskId
  };
}

function selectEmployeeTaskId(queue: readonly WorkforceTaskInstance[], employeeId: WorkforceEmployee['id']) {
  const active = queue.find(
    (task) => task.assignedEmployeeId === employeeId && task.status === 'in-progress'
  );

  if (active) {
    return active.id;
  }

  const queued = queue.find(
    (task) => task.assignedEmployeeId === employeeId && task.status === 'queued'
  );

  return queued?.id ?? null;
}

function computeNextShiftStartTick(simTimeHours: number, employee: WorkforceEmployee): number | null {
  const shiftStart = employee.schedule.shiftStartHour;

  if (typeof shiftStart !== 'number' || !Number.isFinite(shiftStart)) {
    return null;
  }

  const currentDayStart = Math.floor(simTimeHours / HOURS_PER_DAY) * HOURS_PER_DAY;
  const normalizedStart = Math.min(Math.max(0, shiftStart), HOURS_PER_DAY - 1);
  const sameDayStart = currentDayStart + normalizedStart;

  if (sameDayStart > simTimeHours) {
    return sameDayStart;
  }

  return sameDayStart + HOURS_PER_DAY;
}

export function mapWorkforceView(world: SimulationWorld): WorkforceViewReadModel {
  const workforce = world.workforce;
  const roleById = new Map(workforce.roles.map((role) => [role.id, role]));
  const taskQueue = Array.isArray(workforce.taskQueue)
    ? (workforce.taskQueue as WorkforceTaskInstance[])
    : [];
  const taskIndex = new Map(taskQueue.map((task) => [task.id, task]));
  type WorkforceRoleKey = 'gardener' | 'technician' | 'janitor';
  const mutableCounts: Record<WorkforceRoleKey, number> = {
    gardener: 0,
    technician: 0,
    janitor: 0
  };

  for (const employee of workforce.employees) {
    const role = roleById.get(employee.roleId);
    switch (role?.slug) {
      case 'gardener':
        mutableCounts.gardener += 1;
        break;
      case 'technician':
        mutableCounts.technician += 1;
        break;
      case 'janitor':
        mutableCounts.janitor += 1;
        break;
      default:
        break;
    }
  }

  const latestKpi = workforce.kpis.at(-1);
  const employeeStructureIndex = new Map(
    workforce.employees.map((employee) => [employee.id, employee.assignedStructureId])
  );
  const assignmentsByStructure = new Map<
    WorkforceEmployee['assignedStructureId'],
    {
      structureId: WorkforceEmployee['assignedStructureId'];
      structureName: string;
      employeeIds: WorkforceEmployee['id'][];
    }
  >();
  const structureNameById = new Map(
    world.company.structures.map((structure) => [structure.id, structure.name])
  );

  const roster = workforce.employees
    .map((employee) => {
      const role = roleById.get(employee.roleId);
      const currentTaskId = selectEmployeeTaskId(taskQueue, employee.id);
      const nextShiftStartTick = computeNextShiftStartTick(world.simTimeHours, employee);
      const structureId = employee.assignedStructureId;
      const schedule = employee.schedule;
      const baseHoursPerDay = roundTo(schedule.hoursPerDay ?? 0, 3);
      const overtimeHoursPerDay = roundTo(schedule.overtimeHoursPerDay ?? 0, 3);
      const daysPerWeek = roundTo(schedule.daysPerWeek ?? 0, 3);
      const shiftStartHour =
        typeof schedule.shiftStartHour === 'number'
          ? roundTo(Math.max(0, Math.min(23, schedule.shiftStartHour)), 3)
          : 0;

      const structureSummary = assignmentsByStructure.get(structureId);
      if (structureSummary) {
        structureSummary.employeeIds.push(employee.id);
      } else {
        assignmentsByStructure.set(structureId, {
          structureId,
          structureName: structureNameById.get(structureId) ?? structureId,
          employeeIds: [employee.id]
        });
      }

      return {
        employeeId: employee.id,
        displayName: employee.name,
        structureId,
        roleSlug: role?.slug ?? 'unassigned',
        morale01: clampFraction(employee.morale01),
        fatigue01: clampFraction(employee.fatigue01),
        currentTaskId,
        nextShiftStartTick,
        baseHoursPerDay,
        overtimeHoursPerDay,
        daysPerWeek,
        shiftStartHour,
        assignment: {
          scope: 'structure' as const,
          targetId: structureId
        }
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  const assignmentSummaries = Array.from(assignmentsByStructure.values())
    .map((entry) => ({
      structureId: entry.structureId,
      structureName: entry.structureName,
      headcount: entry.employeeIds.length,
      employeeIds: entry.employeeIds.sort((left, right) => left.localeCompare(right))
    }))
    .sort((left, right) => left.structureName.localeCompare(right.structureName));

  return {
    schemaVersion: WORKFORCE_VIEW_SCHEMA_VERSION,
    simTime: world.simTimeHours,
    headcount: workforce.employees.length,
    roles: {
      gardener: mutableCounts.gardener,
      technician: mutableCounts.technician,
      janitor: mutableCounts.janitor
    },
    assignments: assignmentSummaries,
    kpis: {
      utilizationPercent: roundTo((latestKpi?.utilization01 ?? 0) * 100, 2),
      overtimeMinutes: Math.round(latestKpi?.overtimeMinutes ?? 0),
      warnings: workforce.warnings.map((warning) =>
        mapWorkforceWarning(warning, employeeStructureIndex, taskIndex)
      )
    },
    roster
  } satisfies WorkforceViewReadModel;
}
