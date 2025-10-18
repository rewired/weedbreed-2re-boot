import { HOURS_PER_DAY } from '@/backend/src/constants/simConstants';
import type {
  Employee,
  EmployeeRole,
  HiringMarketHireIntent,
  HiringMarketScanIntent,
  SimulationWorld,
  Structure,
  WorkforceIntent,
  WorkforceKpiSnapshot,
  WorkforceMarketState,
  WorkforcePayrollState,
  WorkforceState,
  WorkforceTaskDefinition,
  WorkforceTaskInstance,
  WorkforceWarning,
  Zone,
  WorkforceRaiseIntent,
  WorkforceTerminationIntent,
  WorkforceStructurePayrollTotals,
  HrAssignIntent,
  PestControlIntent,
  MaintenanceIntent,
} from '../domain/world.ts';
import type { LocationIndexTable } from '../domain/payroll/locationIndex.ts';
import { createEmptyLocationIndexTable, resolveLocationIndex } from '../domain/payroll/locationIndex.ts';
import { ensureCultivationTaskRuntime, getCultivationMethodCatalog, scheduleCultivationTasksForZone } from '../cultivation/methodRuntime.ts';
import { consumeDeviceMaintenanceRuntime } from '../device/maintenanceRuntime.ts';
import { TELEMETRY_DEVICE_MAINTENANCE_SCHEDULED_V1, TELEMETRY_DEVICE_REPLACEMENT_RECOMMENDED_V1 } from '../telemetry/topics.ts';
import {
  evaluatePestDiseaseSystem,
  PEST_INSPECTION_TASK_CODE,
  PEST_TREATMENT_TASK_CODE,
} from '../health/pestDiseaseSystem.ts';
import { emitPestDiseaseRiskWarnings, emitPestDiseaseTaskEvents } from '../telemetry/health.ts';
import type { EngineRunContext } from '../engine/Engine.ts';
import { clamp01 } from '../util/math.ts';
import type {
  WorkforceAssignment,
  WorkforceRuntime,
  WorkforceRuntimeMutable,
  WorkforcePayrollAccrualSnapshot,
  WorkforceMarketCharge,
} from './types.ts';
import { resolveWorkforceConfig, processMarketIntents } from './market/candidates.ts';
import { processRaiseIntents } from './intents/raises.ts';
import { processTerminationIntents } from './intents/termination.ts';
import {
  buildSchedulingEntries,
  dispatchTasks,
  groupEmployeesByStructure,
  isMaintenanceTask,
  resolveStructureLookups,
} from './scheduler/dispatch.ts';
import {
  applyPayrollContribution,
  clonePayrollTotals,
  cloneStructurePayroll,
  computePayrollContribution,
  createEmptyPayrollState,
  createEmptyPayrollTotals,
  ensureStructurePayroll,
  finalizePayrollState,
  materializeStructurePayroll,
  resolveStructureLocation,
} from './payroll/accrual.ts';
import { emitWorkforceTelemetry, type DeviceTelemetryEvent } from './telemetry/workforceEmit.ts';

/* eslint-disable @typescript-eslint/no-magic-numbers -- Workforce KPIs use fixed percentile thresholds */
const WAIT_TIME_PERCENTILE = 0.95 as const;
/* eslint-enable @typescript-eslint/no-magic-numbers */

const workforceRuntimeStore = new WeakMap<EngineRunContext, WorkforceRuntimeMutable>();
const workforcePayrollAccrualStore = new WeakMap<EngineRunContext, WorkforcePayrollAccrualSnapshot>();
const workforceMarketChargeStore = new WeakMap<EngineRunContext, readonly WorkforceMarketCharge[]>();
const workforceIntentStore = new WeakMap<EngineRunContext, readonly WorkforceIntent[]>();
const workforceConfigStore = new WeakMap<EngineRunContext, Parameters<typeof resolveWorkforceConfig>[0]>();

export type { WorkforceAssignment, WorkforceRuntime, WorkforceRuntimeMutable, WorkforcePayrollAccrualSnapshot, WorkforceMarketCharge };

function setWorkforceRuntime(ctx: EngineRunContext, runtime: WorkforceRuntimeMutable): WorkforceRuntimeMutable {
  workforceRuntimeStore.set(ctx, runtime);
  return runtime;
}

/**
 * Ensures a mutable runtime snapshot exists for the current tick without mutating the caller-provided context.
 * Mirrors SEC v0.2.1 §2 by avoiding hidden globals and creating explicit state carriers.
 */
export function ensureWorkforceRuntime(ctx: EngineRunContext): WorkforceRuntimeMutable {
  const runtime = workforceRuntimeStore.get(ctx);

  if (runtime) {
    return runtime;
  }

  return setWorkforceRuntime(ctx, { assignments: [] });
}

export function getWorkforceRuntime(ctx: EngineRunContext): WorkforceRuntime | undefined {
  return workforceRuntimeStore.get(ctx);
}

/**
 * Clears the workforce runtime snapshot for the provided context.
 * Uses structural sharing friendly stores to stay compliant with SEC §2 immutability expectations.
 */
export function clearWorkforceRuntime(ctx: EngineRunContext): void {
  workforceRuntimeStore.delete(ctx);
}

function resolveLocationIndexTable(ctx: EngineRunContext): LocationIndexTable {
  const carrier = ctx as EngineRunContext & {
    payroll?: { locationIndexTable?: LocationIndexTable };
  };

  return carrier.payroll?.locationIndexTable ?? createEmptyLocationIndexTable();
}

function setWorkforcePayrollAccrual(ctx: EngineRunContext, snapshot: WorkforcePayrollAccrualSnapshot): void {
  workforcePayrollAccrualStore.set(ctx, snapshot);
}

/**
 * Seeds a payroll accrual snapshot for the context, supporting targeted test scenarios (SEC §2 explicit state injection).
 */
export function seedWorkforcePayrollAccrual(
  ctx: EngineRunContext,
  snapshot: WorkforcePayrollAccrualSnapshot,
): void {
  workforcePayrollAccrualStore.set(ctx, snapshot);
}

/**
 * Returns and clears the payroll accrual snapshot for the context to avoid cross-tick leakage (SEC §2).
 */
export function consumeWorkforcePayrollAccrual(ctx: EngineRunContext): WorkforcePayrollAccrualSnapshot | undefined {
  const snapshot = workforcePayrollAccrualStore.get(ctx);

  if (!snapshot) {
    return undefined;
  }

  workforcePayrollAccrualStore.delete(ctx);
  return snapshot;
}

/**
 * Removes any pending payroll accrual snapshot for the context in line with SEC §2 snapshot semantics.
 */
export function clearWorkforcePayrollAccrual(ctx: EngineRunContext): void {
  workforcePayrollAccrualStore.delete(ctx);
}

function recordWorkforceMarketCharge(ctx: EngineRunContext, charge: WorkforceMarketCharge): void {
  const existing = workforceMarketChargeStore.get(ctx) ?? [];
  workforceMarketChargeStore.set(ctx, [...existing, charge]);
}

/**
 * Retrieves the queued workforce market charges and clears them to keep tick-local side effects deterministic (SEC §2).
 */
export function consumeWorkforceMarketCharges(ctx: EngineRunContext): readonly WorkforceMarketCharge[] | undefined {
  const charges = workforceMarketChargeStore.get(ctx);

  if (!charges) {
    return undefined;
  }

  workforceMarketChargeStore.delete(ctx);
  return charges;
}

/**
 * Queues workforce intents for the next pipeline execution while cloning the payload (SEC §2, no shared mutation).
 */
export function queueWorkforceIntents(ctx: EngineRunContext, intents: readonly WorkforceIntent[]): void {
  workforceIntentStore.set(ctx, [...intents]);
}

/**
 * Seeds an override configuration for workforce processing for the supplied context (SEC §2 explicit state).
 */
export function configureWorkforceContext(
  ctx: EngineRunContext,
  config: Parameters<typeof resolveWorkforceConfig>[0],
): void {
  workforceConfigStore.set(ctx, config);
}

function extractWorkforceIntents(ctx: EngineRunContext): readonly WorkforceIntent[] {
  const intents = workforceIntentStore.get(ctx);
  workforceIntentStore.delete(ctx);
  return intents ?? [];
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
  const index = sortedWaits.length > 0
    ? Math.max(0, Math.ceil(sortedWaits.length * WAIT_TIME_PERCENTILE) - 1)
    : 0;
  const p95Wait = sortedWaits.length > 0 ? sortedWaits[index] : 0;

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

function ensureWorkforceState(state: WorkforceState | undefined, simDay: number): WorkforceState {
  if (state) {
    return state;
  }

  return {
    roles: [],
    employees: [],
    taskDefinitions: [],
    taskQueue: [],
    kpis: [],
    warnings: [],
    payroll: createEmptyPayrollState(simDay),
    market: { structures: [] },
  } satisfies WorkforceState;
}

function appendCultivationTasks(
  world: SimulationWorld,
  workforceState: WorkforceState | undefined,
  ctx: EngineRunContext,
  currentSimHours: number,
  currentSimDay: number,
): WorkforceState | undefined {
  const cultivationRuntime = ensureCultivationTaskRuntime(ctx);
  const cultivationCatalog = getCultivationMethodCatalog();
  const currentTick = Math.trunc(currentSimHours);
  const tasks: WorkforceTaskInstance[] = [];
  const schedulingState = workforceState ?? ensureWorkforceState(undefined, currentSimDay);

  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      for (const zone of room.zones) {
        const scheduled = scheduleCultivationTasksForZone({
          world,
          structure,
          room,
          zone,
          workforce: schedulingState,
          runtime: cultivationRuntime,
          currentTick,
          methodCatalog: cultivationCatalog,
        });

        if (scheduled.length > 0) {
          tasks.push(...scheduled);
        }
      }
    }
  }

  if (tasks.length === 0) {
    return workforceState;
  }

  const baseState = workforceState ?? schedulingState;
  const existingTaskIds = new Set(baseState.taskQueue.map((task) => task.id));
  const filtered = tasks.filter((task) => !existingTaskIds.has(task.id));

  if (filtered.length === 0) {
    return workforceState;
  }

  return {
    ...baseState,
    taskQueue: [...baseState.taskQueue, ...filtered],
  } satisfies WorkforceState;
}

function applyMaintenanceRuntime(
  ctx: EngineRunContext,
  world: SimulationWorld,
  workforceState: WorkforceState,
  definitions: Map<WorkforceTaskDefinition['taskCode'], WorkforceTaskDefinition>,
  taskQueue: WorkforceTaskInstance[],
): {
  readonly taskQueue: WorkforceTaskInstance[];
  readonly warnings: WorkforceWarning[];
  readonly deviceEvents: DeviceTelemetryEvent[];
} {
  const runtime = consumeDeviceMaintenanceRuntime(ctx);

  if (!runtime) {
    return { taskQueue, warnings: [], deviceEvents: [] };
  }

  const warnings: WorkforceWarning[] = [];
  const deviceEvents: DeviceTelemetryEvent[] = [];
  const maintainDefinition = definitions.get('maintain_device');
  const existingTaskIds = new Set(taskQueue.map((task) => task.id));

  if (runtime.scheduledTasks.length > 0 && !maintainDefinition) {
    warnings.push({
      simTimeHours: world.simTimeHours,
      code: 'workforce.maintenance.definition_missing',
      message: 'Maintenance tasks could not be scheduled because the maintain_device definition is missing.',
      severity: 'warning',
    });
  }

  let nextQueue = taskQueue;

  if (maintainDefinition) {
    for (const plan of runtime.scheduledTasks) {
      if (!plan.workshopRoomId) {
        warnings.push({
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

      nextQueue = [...nextQueue, newTask];
      existingTaskIds.add(plan.taskId);

      deviceEvents.push({
        topic: TELEMETRY_DEVICE_MAINTENANCE_SCHEDULED_V1,
        payload: {
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
        },
      });
    }
  }

  if (runtime.completedTasks.length > 0) {
    const completedIds = new Set(runtime.completedTasks.map((entry) => entry.taskId));
    nextQueue = nextQueue.map((task) => {
      if (!completedIds.has(task.id) || task.status === 'completed') {
        return task;
      }

      return { ...task, status: 'completed' } satisfies WorkforceTaskInstance;
    });
  }

  if (runtime.replacements.length > 0) {
    for (const recommendation of runtime.replacements) {
      deviceEvents.push({
        topic: TELEMETRY_DEVICE_REPLACEMENT_RECOMMENDED_V1,
        payload: {
          deviceId: recommendation.deviceId,
          structureId: recommendation.structureId,
          roomId: recommendation.roomId,
          zoneId: recommendation.zoneId,
          recommendedSinceTick: recommendation.recommendedSinceTick,
          totalMaintenanceCostCc: recommendation.totalMaintenanceCostCc,
          replacementCostCc: recommendation.replacementCostCc,
        },
      });

      warnings.push({
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

  return { taskQueue: nextQueue, warnings, deviceEvents };
}

function resolveStructureMaps(structures: readonly Structure[]): {
  readonly indexLookup: Map<Structure['id'], number>;
  readonly byId: Map<Structure['id'], Structure>;
} {
  const indexLookup = new Map<Structure['id'], number>();
  const byId = new Map<Structure['id'], Structure>();

  structures.forEach((structure, index) => {
    indexLookup.set(structure.id, index);
    byId.set(structure.id, structure);
  });

  return { indexLookup, byId };
}

interface AssignmentResolution {
  readonly scope: 'structure' | 'room' | 'zone';
  readonly structureId: Structure['id'];
}

function resolveAssignmentTarget(
  world: SimulationWorld,
  targetId: HrAssignIntent['targetId'],
): AssignmentResolution | undefined {
  for (const structure of world.company.structures) {
    if (structure.id === targetId) {
      return { scope: 'structure', structureId: structure.id };
    }

    for (const room of structure.rooms) {
      if (room.id === targetId) {
        return { scope: 'room', structureId: structure.id };
      }

      for (const zone of room.zones) {
        if (zone.id === targetId) {
          return { scope: 'zone', structureId: structure.id };
        }
      }
    }
  }

  return undefined;
}

function processHrAssignIntents({
  world,
  intents,
  employees,
  simTimeHours,
}: {
  readonly world: SimulationWorld;
  readonly intents: readonly HrAssignIntent[];
  readonly employees: readonly Employee[];
  readonly simTimeHours: number;
}): { readonly employees: readonly Employee[]; readonly warnings: readonly WorkforceWarning[] } {
  if (intents.length === 0) {
    return { employees, warnings: [] };
  }

  const directory = new Map<Employee['id'], Employee>();
  employees.forEach((employee) => {
    directory.set(employee.id, employee);
  });

  const warnings: WorkforceWarning[] = [];

  for (const intent of intents) {
    const employee = directory.get(intent.employeeId);

    if (!employee) {
      warnings.push({
        simTimeHours,
        code: 'workforce.hr.employee_missing',
        message: `Employee ${intent.employeeId} could not be reassigned because the record is missing.`,
        severity: 'warning',
        metadata: { employeeId: intent.employeeId, targetId: intent.targetId },
      });
      continue;
    }

    const target = resolveAssignmentTarget(world, intent.targetId);

    if (!target) {
      warnings.push({
        simTimeHours,
        code: 'workforce.hr.assignment_target_missing',
        message: `Assignment target ${intent.targetId} is not part of the company hierarchy.`,
        severity: 'warning',
        metadata: { employeeId: intent.employeeId, targetId: intent.targetId },
      });
      continue;
    }

    if (employee.assignedStructureId === target.structureId) {
      continue;
    }

    directory.set(employee.id, {
      ...employee,
      assignedStructureId: target.structureId,
    } satisfies Employee);
  }

  const nextEmployees = employees.map((employee) => directory.get(employee.id) ?? employee);
  return { employees: nextEmployees, warnings };
}

function resolveTaskStructureId(
  task: WorkforceTaskInstance,
  lookups: ReturnType<typeof resolveStructureLookups>,
): Structure['id'] | undefined {
  const context = task.context ?? {};
  const structureId = context.structureId;

  if (typeof structureId === 'string') {
    return structureId as Structure['id'];
  }

  const roomId = context.roomId;

  if (typeof roomId === 'string') {
    const resolved = lookups.roomToStructure.get(roomId);
    if (resolved) {
      return resolved;
    }
  }

  const zoneId = context.zoneId;

  if (typeof zoneId === 'string') {
    const resolved = lookups.zoneToStructure.get(zoneId);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

function processManualTaskIntents({
  world,
  taskQueue,
  pestIntents,
  maintenanceIntents,
  employees,
  simTimeHours,
  lookups,
}: {
  readonly world: SimulationWorld;
  readonly taskQueue: readonly WorkforceTaskInstance[];
  readonly pestIntents: readonly PestControlIntent[];
  readonly maintenanceIntents: readonly MaintenanceIntent[];
  readonly employees: readonly Employee[];
  readonly simTimeHours: number;
  readonly lookups: ReturnType<typeof resolveStructureLookups>;
}): { readonly taskQueue: WorkforceTaskInstance[]; readonly warnings: readonly WorkforceWarning[] } {
  if (pestIntents.length === 0 && maintenanceIntents.length === 0) {
    return { taskQueue: [...taskQueue], warnings: [] };
  }

  let queue = [...taskQueue];
  const warnings: WorkforceWarning[] = [];
  const capacityByStructure = new Map<Structure['id'], number>();

  for (const employee of employees) {
    const current = capacityByStructure.get(employee.assignedStructureId) ?? 0;
    capacityByStructure.set(employee.assignedStructureId, current + 1);
  }

  const activeCounts = new Map<Structure['id'], number>();

  for (const task of queue) {
    if (task.status !== 'in-progress') {
      continue;
    }

    const structureId = resolveTaskStructureId(task, lookups);

    if (structureId) {
      activeCounts.set(structureId, (activeCounts.get(structureId) ?? 0) + 1);
    }
  }

  const ensureCapacity = (
    structureId: Structure['id'],
    code: string,
    message: string,
    metadata: Record<string, unknown>,
  ): boolean => {
    const capacity = capacityByStructure.get(structureId) ?? 0;
    const active = activeCounts.get(structureId) ?? 0;

    if (capacity <= active) {
      warnings.push({
        simTimeHours,
        code,
        message,
        severity: 'warning',
        structureId,
        metadata,
      });
      return false;
    }

    activeCounts.set(structureId, active + 1);
    return true;
  };

  const releaseCapacity = (structureId: Structure['id'] | undefined) => {
    if (!structureId) {
      return;
    }

    const active = activeCounts.get(structureId);

    if (active === undefined) {
      return;
    }

    if (active <= 1) {
      activeCounts.delete(structureId);
      return;
    }

    activeCounts.set(structureId, active - 1);
  };

  const updateTaskAtIndex = (
    index: number,
    updater: (task: WorkforceTaskInstance) => WorkforceTaskInstance,
  ) => {
    queue = queue.map((task, taskIndex) => (taskIndex === index ? updater(task) : task));
  };

  for (const intent of pestIntents) {
    const taskCode =
      intent.type === 'pest.inspect.start' || intent.type === 'pest.inspect.complete'
        ? PEST_INSPECTION_TASK_CODE
        : PEST_TREATMENT_TASK_CODE;
    const zoneId = intent.zoneId;
    const structureId = lookups.zoneToStructure.get(zoneId);

    if (!structureId) {
      warnings.push({
        simTimeHours,
        code: 'workforce.pest.assignment_target_missing',
        message: `Zone ${zoneId} is not registered in the company structures.`,
        severity: 'warning',
        metadata: { zoneId, taskCode },
      });
      continue;
    }

    if (intent.type === 'pest.inspect.start' || intent.type === 'pest.treat.start') {
      const taskIndex = queue.findIndex(
        (task) =>
          task.taskCode === taskCode &&
          (task.context?.zoneId as Zone['id'] | undefined) === zoneId &&
          task.status === 'queued',
      );

      if (taskIndex === -1) {
        warnings.push({
          simTimeHours,
          code: 'workforce.pest.task_missing',
          message: `No queued ${taskCode} task found for zone ${zoneId}.`,
          severity: 'warning',
          structureId,
          metadata: { zoneId, taskCode },
        });
        continue;
      }

      const ensured = ensureCapacity(
        structureId,
        'workforce.pest.capacity_overflow',
        `Cannot start ${taskCode} in zone ${zoneId} because all assigned employees are busy.`,
        { zoneId, taskCode },
      );

      if (!ensured) {
        continue;
      }

      updateTaskAtIndex(taskIndex, (task) => ({
        ...task,
        status: 'in-progress',
        context: { ...task.context, acknowledgedAtTick: simTimeHours },
      } satisfies WorkforceTaskInstance));
      continue;
    }

    let taskIndex = queue.findIndex(
      (task) =>
        task.taskCode === taskCode &&
        (task.context?.zoneId as Zone['id'] | undefined) === zoneId &&
        task.status === 'in-progress',
    );

    let releaseStructure: Structure['id'] | undefined;

    if (taskIndex === -1) {
      taskIndex = queue.findIndex(
        (task) =>
          task.taskCode === taskCode &&
          (task.context?.zoneId as Zone['id'] | undefined) === zoneId,
      );
    } else {
      releaseStructure = structureId;
    }

    if (taskIndex === -1) {
      warnings.push({
        simTimeHours,
        code: 'workforce.pest.task_missing',
        message: `No active ${taskCode} task found for zone ${zoneId}.`,
        severity: 'warning',
        structureId,
        metadata: { zoneId, taskCode },
      });
      continue;
    }

    updateTaskAtIndex(taskIndex, (task) => ({
      ...task,
      status: 'completed',
      context: { ...task.context, completedAtTick: simTimeHours },
    } satisfies WorkforceTaskInstance));
    releaseCapacity(releaseStructure ?? resolveTaskStructureId(queue[taskIndex], lookups));
  }

  for (const intent of maintenanceIntents) {
    const deviceId = intent.deviceId;
    const taskIndex = queue.findIndex(
      (task) =>
        isMaintenanceTask(task) &&
        (task.context?.deviceId as string | undefined) === deviceId &&
        (intent.type === 'maintenance.start' ? task.status === 'queued' : true),
    );

    if (taskIndex === -1) {
      warnings.push({
        simTimeHours,
        code: 'workforce.maintenance.task_missing',
        message: `No maintenance task found for device ${deviceId}.`,
        severity: 'warning',
        metadata: { deviceId },
      });
      continue;
    }

    const structureId = resolveTaskStructureId(queue[taskIndex], lookups);

    if (intent.type === 'maintenance.start') {
      const ensured = ensureCapacity(
        structureId ?? (world.company.structures[0]?.id ?? ('unknown-structure' as Structure['id'])),
        'workforce.maintenance.capacity_overflow',
        `Cannot start maintenance for device ${deviceId} because all assigned employees are busy.`,
        { deviceId },
      );

      if (!ensured) {
        continue;
      }

      updateTaskAtIndex(taskIndex, (task) => ({
        ...task,
        status: 'in-progress',
        context: { ...task.context, acknowledgedAtTick: simTimeHours },
      } satisfies WorkforceTaskInstance));
      continue;
    }

    const activeTaskIndex = queue.findIndex(
      (task) =>
        isMaintenanceTask(task) &&
        (task.context?.deviceId as string | undefined) === deviceId &&
        task.status === 'in-progress',
    );

    if (activeTaskIndex !== -1) {
      updateTaskAtIndex(activeTaskIndex, (task) => ({
        ...task,
        status: 'completed',
        context: { ...task.context, completedAtTick: simTimeHours },
      } satisfies WorkforceTaskInstance));
      releaseCapacity(resolveTaskStructureId(queue[activeTaskIndex], lookups));
      continue;
    }

    updateTaskAtIndex(taskIndex, (task) => ({
      ...task,
      status: 'completed',
      context: { ...task.context, completedAtTick: simTimeHours },
    } satisfies WorkforceTaskInstance));
    releaseCapacity(resolveTaskStructureId(queue[taskIndex], lookups));
  }

  return { taskQueue: queue, warnings };
}

function resolveRoleMap(roles: readonly EmployeeRole[]): Map<EmployeeRole['id'], EmployeeRole> {
  const map = new Map<EmployeeRole['id'], EmployeeRole>();

  for (const role of roles) {
    map.set(role.id, role);
  }

  return map;
}

function partitionIntents(
  intents: readonly WorkforceIntent[],
): {
  readonly market: readonly (HiringMarketScanIntent | HiringMarketHireIntent)[];
  readonly raises: readonly WorkforceRaiseIntent[];
  readonly terminations: readonly WorkforceTerminationIntent[];
  readonly hr: readonly HrAssignIntent[];
  readonly pest: readonly PestControlIntent[];
  readonly maintenance: readonly MaintenanceIntent[];
} {
  const market: (HiringMarketScanIntent | HiringMarketHireIntent)[] = [];
  const raises: WorkforceRaiseIntent[] = [];
  const terminations: WorkforceTerminationIntent[] = [];
  const hr: HrAssignIntent[] = [];
  const pest: PestControlIntent[] = [];
  const maintenance: MaintenanceIntent[] = [];

  for (const intent of intents) {
    switch (intent.type) {
      case 'hiring.market.scan':
      case 'hiring.market.hire':
        market.push(intent);
        break;

      case 'workforce.raise.accept':
      case 'workforce.raise.bonus':
      case 'workforce.raise.ignore':
        raises.push(intent);
        break;

      case 'workforce.employee.terminate':
        terminations.push(intent);
        break;

      case 'hr.assign':
        hr.push(intent);
        break;

      case 'pest.inspect.start':
      case 'pest.inspect.complete':
      case 'pest.treat.start':
      case 'pest.treat.complete':
        pest.push(intent);
        break;

      case 'maintenance.start':
      case 'maintenance.complete':
        maintenance.push(intent);
        break;

      default:
        break;
    }
  }

  return { market, raises, terminations, hr, pest, maintenance };
}

export function applyWorkforce(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const runtime = ensureWorkforceRuntime(ctx);
  const originalWorkforceState = world.workforce;
  const currentSimHours = Number.isFinite(world.simTimeHours) ? world.simTimeHours : 0;
  const currentSimDay = Math.floor(currentSimHours / HOURS_PER_DAY);

  const workforceAfterScheduling = appendCultivationTasks(
    world,
    originalWorkforceState,
    ctx,
    currentSimHours,
    currentSimDay,
  );
  let workforceState = workforceAfterScheduling ?? originalWorkforceState;

  const pestEvaluation = evaluatePestDiseaseSystem(world, currentSimHours);

  if (pestEvaluation.scheduledTasks.length > 0) {
    workforceState = ensureWorkforceState(workforceState, currentSimDay);
    const existingTaskIds = new Set(workforceState.taskQueue.map((task) => task.id));
    const newTasks = pestEvaluation.scheduledTasks.filter((task) => !existingTaskIds.has(task.id));

    if (newTasks.length > 0) {
      workforceState = { ...workforceState, taskQueue: [...workforceState.taskQueue, ...newTasks] };
    }
  }

  const shouldUpdateHealth = world.health !== pestEvaluation.health;
  const shouldUpdateWorkforce =
    workforceState !== originalWorkforceState;

  if (shouldUpdateHealth || shouldUpdateWorkforce) {
    world = {
      ...world,
      health: pestEvaluation.health,
      workforce: workforceState
    } satisfies SimulationWorld;
  }

  emitPestDiseaseRiskWarnings(ctx.telemetry, pestEvaluation.warnings);
  emitPestDiseaseTaskEvents(ctx.telemetry, pestEvaluation.taskEvents);

  const workforceConfig = resolveWorkforceConfig(workforceConfigStore.get(ctx));
  const intents = extractWorkforceIntents(ctx);
  const partitions = partitionIntents(intents);
  let marketState: WorkforceMarketState = workforceState.market;
  const marketResult = processMarketIntents({
    intents: partitions.market,
    marketState,
    config: workforceConfig.market,
    worldSeed: world.seed,
    currentSimHours,
    currentSimDay,
    roles: workforceState.roles,
  });
  marketState = marketResult.market;
  marketResult.charges.forEach((charge) => { recordWorkforceMarketCharge(ctx, charge); });

  const employeesAfterHire =
    marketResult.newEmployees.length > 0
      ? [...workforceState.employees, ...marketResult.newEmployees]
      : workforceState.employees;

  const employeeDirectory = new Map<Employee['id'], Employee>();
  for (const employee of employeesAfterHire) {
    employeeDirectory.set(employee.id, employee);
  }

  const raiseResult = processRaiseIntents({
    employees: employeeDirectory,
    intents: partitions.raises,
    currentSimDay,
  });
  const terminationResult = processTerminationIntents({
    employees: raiseResult.employees,
    intents: partitions.terminations,
    currentSimDay,
  });

  const employeesAfterHrEvents = employeesAfterHire
    .map((employee) => terminationResult.employees.get(employee.id))
    .filter((employee): employee is Employee => Boolean(employee));

  const hrResult = processHrAssignIntents({
    world,
    intents: partitions.hr,
    employees: employeesAfterHrEvents,
    simTimeHours: currentSimHours,
  });

  workforceState = {
    ...workforceState,
    employees: hrResult.employees,
    market: marketState,
  } satisfies WorkforceState;

  let taskQueue = workforceState.taskQueue;

  if (terminationResult.terminatedIds.size > 0) {
    taskQueue = workforceState.taskQueue.map((task) => {
      if (!task.assignedEmployeeId || !terminationResult.terminatedIds.has(task.assignedEmployeeId)) {
        return task;
      }

      return {
        ...task,
        status: task.status === 'completed' ? task.status : 'queued',
        assignedEmployeeId: undefined,
      } satisfies WorkforceTaskInstance;
    });
  }

  const roleById = resolveRoleMap(workforceState.roles);
  const lookups = resolveStructureLookups(world.company.structures);
  const { indexLookup: structureIndexLookup, byId: structureById } = resolveStructureMaps(world.company.structures);
  const maintenanceResult = applyMaintenanceRuntime(ctx, world, workforceState, new Map(
    workforceState.taskDefinitions.map((definition) => [definition.taskCode, definition]),
  ), taskQueue);

  taskQueue = maintenanceResult.taskQueue;
  const maintenanceWarnings = maintenanceResult.warnings;

  const manualTaskResult = processManualTaskIntents({
    world,
    taskQueue,
    pestIntents: partitions.pest,
    maintenanceIntents: partitions.maintenance,
    employees: workforceState.employees,
    simTimeHours: currentSimHours,
    lookups,
  });

  taskQueue = manualTaskResult.taskQueue;
  const companyLocation = world.company.location;
  const locationIndexTable = resolveLocationIndexTable(ctx);
  const definitions = new Map<WorkforceTaskDefinition['taskCode'], WorkforceTaskDefinition>(
    workforceState.taskDefinitions.map((definition) => [definition.taskCode, definition]),
  );

  const previousPayroll = workforceState.payroll;
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

  const employeesByStructure = groupEmployeesByStructure(workforceState.employees);
  const schedulingEntries = buildSchedulingEntries(taskQueue, definitions, lookups);
  const dispatchOutcome = dispatchTasks(schedulingEntries, {
    simTimeHours: world.simTimeHours,
    structureIndexLookup,
    roleById,
    isZoneQuarantined: (zoneId) => isZoneQuarantined(world, zoneId, world.simTimeHours),
  }, employeesByStructure);

  const waitTimes = [...dispatchOutcome.waitTimes];
  const totalBaseMinutes = dispatchOutcome.totalBaseMinutes;
  const totalOvertimeMinutes = dispatchOutcome.totalOvertimeMinutes;
  const tasksCompleted = dispatchOutcome.tasksCompleted;

  for (const contribution of dispatchOutcome.contributions) {
    const structure = structureById.get(contribution.structureId);
    const location = resolveStructureLocation(structure, companyLocation);
    const locationIndex = resolveLocationIndex(locationIndexTable, location);
    const role = roleById.get(contribution.roleId);
    const payrollContribution = computePayrollContribution(
      contribution.employee,
      role,
      contribution.definition,
      contribution.baseMinutes,
      contribution.overtimeMinutes,
      locationIndex,
    );
    applyPayrollContribution(payrollTotals, payrollContribution);
    const structureTotals = ensureStructurePayroll(structurePayroll, contribution.structureId);
    applyPayrollContribution(structureTotals, payrollContribution);
  }

  payrollTotals.totalLaborCost = payrollTotals.baseCost + payrollTotals.otCost;

  const nextEmployees = workforceState.employees.map(
    (employee) => dispatchOutcome.updatedEmployees.get(employee.id) ?? employee,
  );
  const updatedTasks = taskQueue.map((task) => dispatchOutcome.taskUpdates.get(task.id) ?? task);
  const queueDepth = updatedTasks.reduce((count, item) => (item.status === 'queued' ? count + 1 : count), 0);
  const maintenanceBacklog = updatedTasks.reduce(
    (count, item) => (item.status === 'queued' && isMaintenanceTask(item) ? count + 1 : count),
    0,
  );

  const currentPayrollState: WorkforcePayrollState = {
    dayIndex: payrollDayIndex,
    totals: { ...payrollTotals },
    byStructure: materializeStructurePayroll(structurePayroll),
  } satisfies WorkforcePayrollState;

  setWorkforcePayrollAccrual(ctx, { current: currentPayrollState, finalized: finalizedPayroll });

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

  runtime.assignments.push(...dispatchOutcome.assignments);
  runtime.kpiSnapshot = snapshot;

  const combinedWarnings = [
    ...workforceState.warnings,
    ...maintenanceWarnings,
    ...hrResult.warnings,
    ...manualTaskResult.warnings,
  ];

  const nextWorkforce: WorkforceState = {
    ...workforceState,
    employees: nextEmployees,
    taskQueue: updatedTasks,
    kpis: [...workforceState.kpis, snapshot],
    warnings: combinedWarnings,
    payroll: currentPayrollState,
  } satisfies WorkforceState;

  emitWorkforceTelemetry(ctx.telemetry, {
    snapshot,
    payroll: currentPayrollState,
    warnings: combinedWarnings.length > 0 ? combinedWarnings : undefined,
    raises: raiseResult.telemetry,
    terminations: terminationResult.telemetry,
    marketScans: marketResult.scanTelemetry,
    hires: marketResult.hireTelemetry,
    deviceEvents: maintenanceResult.deviceEvents,
  });

  return { ...world, workforce: nextWorkforce } satisfies SimulationWorld;
}
