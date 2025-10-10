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
} from '../domain/world.ts';
import type { LocationIndexTable } from '../domain/payroll/locationIndex.ts';
import { createEmptyLocationIndexTable, resolveLocationIndex } from '../domain/payroll/locationIndex.ts';
import { ensureCultivationTaskRuntime, getCultivationMethodCatalog, scheduleCultivationTasksForZone } from '../cultivation/methodRuntime.ts';
import { consumeDeviceMaintenanceRuntime } from '../device/maintenanceRuntime.ts';
import { TELEMETRY_DEVICE_MAINTENANCE_SCHEDULED_V1, TELEMETRY_DEVICE_REPLACEMENT_RECOMMENDED_V1 } from '../telemetry/topics.ts';
import { evaluatePestDiseaseSystem } from '../health/pestDiseaseSystem.ts';
import { emitPestDiseaseRiskWarnings, emitPestDiseaseTaskEvents } from '../telemetry/health.ts';
import type { EngineRunContext } from '../engine/Engine.ts';
import { clamp01 } from '../util/math.ts';
import type { WorkforceAssignment, WorkforceRuntime, WorkforceRuntimeMutable, WorkforcePayrollAccrualSnapshot, WorkforceMarketCharge } from './types.ts';
import { resolveWorkforceConfig, processMarketIntents } from './market/candidates.ts';
import { processRaiseIntents } from './intents/raises.ts';
import { processTerminationIntents } from './intents/termination.ts';
import { buildSchedulingEntries, dispatchTasks, groupEmployeesByStructure, isMaintenanceTask, resolveStructureLookups } from './scheduler/dispatch.ts';
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

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type WorkforceRuntimeCarrier = Mutable<EngineRunContext> & {
  __wb_workforceRuntime?: WorkforceRuntimeMutable;
};

type PayrollContextCarrier = Mutable<EngineRunContext> & {
  payroll?: { locationIndexTable?: LocationIndexTable };
  __wb_workforcePayrollAccrual?: WorkforcePayrollAccrualSnapshot;
};

type WorkforceMarketChargeCarrier = Mutable<EngineRunContext> & {
  __wb_workforceMarketCharges?: WorkforceMarketCharge[];
};

type WorkforceIntentCarrier = Mutable<EngineRunContext> & {
  workforceIntents?: readonly WorkforceIntent[];
  workforceConfig?: Parameters<typeof resolveWorkforceConfig>[0];
};

const WORKFORCE_RUNTIME_CONTEXT_KEY = '__wb_workforceRuntime' as const;
const WORKFORCE_PAYROLL_CONTEXT_KEY = '__wb_workforcePayrollAccrual' as const;
const WORKFORCE_MARKET_CHARGES_CONTEXT_KEY = '__wb_workforceMarketCharges' as const;

export type { WorkforceAssignment, WorkforceRuntime, WorkforceRuntimeMutable, WorkforcePayrollAccrualSnapshot, WorkforceMarketCharge };

function setWorkforceRuntime(ctx: EngineRunContext, runtime: WorkforceRuntimeMutable): WorkforceRuntimeMutable {
  (ctx as WorkforceRuntimeCarrier)[WORKFORCE_RUNTIME_CONTEXT_KEY] = runtime;
  return runtime;
}

export function ensureWorkforceRuntime(ctx: EngineRunContext): WorkforceRuntimeMutable {
  return setWorkforceRuntime(ctx, { assignments: [] });
}

export function getWorkforceRuntime(ctx: EngineRunContext): WorkforceRuntime | undefined {
  return (ctx as WorkforceRuntimeCarrier)[WORKFORCE_RUNTIME_CONTEXT_KEY];
}

export function clearWorkforceRuntime(ctx: EngineRunContext): void {
  delete (ctx as WorkforceRuntimeCarrier)[WORKFORCE_RUNTIME_CONTEXT_KEY];
}

function resolveLocationIndexTable(ctx: EngineRunContext): LocationIndexTable {
  const carrier = ctx as PayrollContextCarrier;
  return carrier.payroll?.locationIndexTable ?? createEmptyLocationIndexTable();
}

function setWorkforcePayrollAccrual(ctx: EngineRunContext, snapshot: WorkforcePayrollAccrualSnapshot): void {
  (ctx as PayrollContextCarrier)[WORKFORCE_PAYROLL_CONTEXT_KEY] = snapshot;
}

export function consumeWorkforcePayrollAccrual(ctx: EngineRunContext): WorkforcePayrollAccrualSnapshot | undefined {
  const carrier = ctx as PayrollContextCarrier;
  const snapshot = carrier[WORKFORCE_PAYROLL_CONTEXT_KEY];

  if (!snapshot) {
    return undefined;
  }

  delete carrier[WORKFORCE_PAYROLL_CONTEXT_KEY];
  return snapshot;
}

export function clearWorkforcePayrollAccrual(ctx: EngineRunContext): void {
  delete (ctx as PayrollContextCarrier)[WORKFORCE_PAYROLL_CONTEXT_KEY];
}

function recordWorkforceMarketCharge(ctx: EngineRunContext, charge: WorkforceMarketCharge): void {
  const carrier = ctx as WorkforceMarketChargeCarrier;
  const existing = carrier[WORKFORCE_MARKET_CHARGES_CONTEXT_KEY] ?? [];
  carrier[WORKFORCE_MARKET_CHARGES_CONTEXT_KEY] = [...existing, charge];
}

export function consumeWorkforceMarketCharges(ctx: EngineRunContext): readonly WorkforceMarketCharge[] | undefined {
  const carrier = ctx as WorkforceMarketChargeCarrier;
  const charges = carrier[WORKFORCE_MARKET_CHARGES_CONTEXT_KEY];

  if (!charges) {
    return undefined;
  }

  delete carrier[WORKFORCE_MARKET_CHARGES_CONTEXT_KEY];
  return charges;
}

function extractWorkforceIntents(ctx: EngineRunContext): readonly WorkforceIntent[] {
  const carrier = ctx as WorkforceIntentCarrier;
  const intents = carrier.workforceIntents ?? [];

  if (carrier.workforceIntents) {
    delete carrier.workforceIntents;
  }

  return intents;
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
} {
  const market: (HiringMarketScanIntent | HiringMarketHireIntent)[] = [];
  const raises: WorkforceRaiseIntent[] = [];
  const terminations: WorkforceTerminationIntent[] = [];

  for (const intent of intents) {
    if (intent.type === 'hiring.market.scan' || intent.type === 'hiring.market.hire') {
      market.push(intent);
      continue;
    }

    if (
      intent.type === 'workforce.raise.accept' ||
      intent.type === 'workforce.raise.bonus' ||
      intent.type === 'workforce.raise.ignore'
    ) {
      raises.push(intent as WorkforceRaiseIntent);
      continue;
    }

    if (intent.type === 'workforce.employee.terminate') {
      terminations.push(intent);
    }
  }

  return { market, raises, terminations };
}

export function applyWorkforce(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const runtime = ensureWorkforceRuntime(ctx);
  let workforceState = (world as SimulationWorld & { workforce?: WorkforceState }).workforce;
  const currentSimHours = Number.isFinite(world.simTimeHours) ? world.simTimeHours : 0;
  const currentSimDay = Math.floor(currentSimHours / HOURS_PER_DAY);

  workforceState = appendCultivationTasks(world, workforceState, ctx, currentSimHours, currentSimDay);

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
  const shouldUpdateWorkforce = (world as SimulationWorld & { workforce?: WorkforceState }).workforce !== workforceState;

  if (shouldUpdateHealth || shouldUpdateWorkforce) {
    world = { ...world, health: pestEvaluation.health, workforce: workforceState } satisfies SimulationWorld;
  }

  emitPestDiseaseRiskWarnings(ctx.telemetry, pestEvaluation.warnings);
  emitPestDiseaseTaskEvents(ctx.telemetry, pestEvaluation.taskEvents);

  if (!workforceState) {
    runtime.kpiSnapshot = createSnapshot(world.simTimeHours, [], 0, 0, 0, 0, 0, []);
    clearWorkforcePayrollAccrual(ctx);
    return world;
  }

  const workforceConfig = resolveWorkforceConfig((ctx as WorkforceIntentCarrier).workforceConfig);
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
  marketResult.charges.forEach((charge) => recordWorkforceMarketCharge(ctx, charge));

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

  workforceState = {
    ...workforceState,
    employees: employeesAfterHrEvents,
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
  let totalBaseMinutes = dispatchOutcome.totalBaseMinutes;
  let totalOvertimeMinutes = dispatchOutcome.totalOvertimeMinutes;
  let tasksCompleted = dispatchOutcome.tasksCompleted;

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

