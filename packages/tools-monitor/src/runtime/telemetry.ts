import { z, type ZodType } from 'zod';
import {
  appendLog,
  type MaintenanceReplacementEvent,
  type MaintenanceScheduledEvent,
  type MonitorState,
  type PestDiseaseTaskEvent,
  type PestDiseaseWarning,
  type RenderConfig,
  type WorkforceKpiSnapshot,
  type WorkforcePayrollSnapshot,
  type WorkforceWarning,
} from './state.ts';
import {
  type EconomyPanelView,
  type EnergyPanelView,
  type HealthPanelView,
  type MaintenancePanelView,
  type MonitorEventLogEntry,
  type MonitorViewModel,
  type TelemetryMessage,
  type WorkforcePanelView,
} from './types.ts';

const MAX_PEST_TASK_EVENTS = 25;
const SUMMARY_ID_PREFIX_LENGTH = 8;
const MAX_HEALTH_NOTES = 5;
const MAX_MAINTENANCE_SUMMARIES = 5;
const COST_PRECISION_DECIMALS = 4;

const workforceKpiSnapshotSchema = z
  .object({
    simTimeHours: z.number().finite(),
    tasksCompleted: z.number().finite(),
    queueDepth: z.number().finite(),
    laborHoursCommitted: z.number().finite(),
    overtimeHoursCommitted: z.number().finite(),
    overtimeMinutes: z.number().finite(),
    utilization01: z.number().min(0).max(1),
    p95WaitTimeHours: z.number().min(0).finite(),
    maintenanceBacklog: z.number().min(0).finite(),
    averageMorale01: z.number().min(0).max(1),
    averageFatigue01: z.number().min(0).max(1),
  })
  .readonly() satisfies ZodType<WorkforceKpiSnapshot>;

const workforceWarningSchema = z
  .object({
    simTimeHours: z.number().finite(),
    code: z.string(),
    message: z.string(),
    severity: z.union([z.literal('info'), z.literal('warning'), z.literal('critical')]),
    structureId: z.string().optional(),
    employeeId: z.string().optional(),
    taskId: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .readonly() satisfies ZodType<WorkforceWarning>;

const pestDiseaseWarningSchema = z
  .object({
    structureId: z.string(),
    roomId: z.string(),
    zoneId: z.string(),
    riskLevel: z.string(),
    risk01: z.number().min(0).max(1),
    tick: z.number().finite(),
  })
  .readonly() satisfies ZodType<PestDiseaseWarning>;

const pestDiseaseTaskEventSchema = z
  .object({
    taskId: z.string(),
    taskCode: z.string(),
    structureId: z.string(),
    roomId: z.string(),
    zoneId: z.string(),
    tick: z.number().finite(),
    riskLevel: z.string(),
    risk01: z.number().min(0).max(1),
  })
  .readonly() satisfies ZodType<PestDiseaseTaskEvent>;

const maintenanceScheduledSchema = z
  .object({
    taskId: z.string(),
    deviceId: z.string(),
    structureId: z.string().optional(),
    roomId: z.string().optional(),
    zoneId: z.string().optional(),
    startTick: z.number().finite(),
    endTick: z.number().finite(),
    serviceHours: z.number().min(0).finite(),
    reason: z.string(),
    serviceVisitCostCc: z.number().min(0).finite(),
  })
  .readonly() satisfies ZodType<MaintenanceScheduledEvent>;

const maintenanceReplacementSchema = z
  .object({
    deviceId: z.string(),
    structureId: z.string().optional(),
    roomId: z.string().optional(),
    zoneId: z.string().optional(),
    recommendedSinceTick: z.number().finite(),
    totalMaintenanceCostCc: z.number().min(0).finite(),
    replacementCostCc: z.number().min(0).finite(),
  })
  .readonly() satisfies ZodType<MaintenanceReplacementEvent>;

const workforcePayrollTotalsSchema = z.object({
  baseMinutes: z.number().min(0).finite(),
  otMinutes: z.number().min(0).finite(),
  baseCost: z.number().finite(),
  otCost: z.number().finite(),
  totalLaborCost: z.number().finite(),
});

const workforceStructurePayrollTotalsSchema = workforcePayrollTotalsSchema.extend({
  structureId: z.string(),
});

const workforcePayrollSnapshotSchema = z
  .object({
    dayIndex: z.number().int().min(0),
    totals: workforcePayrollTotalsSchema,
    byStructure: z.array(workforceStructurePayrollTotalsSchema).readonly(),
  })
  .readonly() satisfies ZodType<WorkforcePayrollSnapshot>;

function handleWorkforceKpi(state: MonitorState, payload: unknown, config: RenderConfig): void {
  const parsed = z
    .object({
      snapshot: workforceKpiSnapshotSchema,
    })
    .parse(payload);

  state.workforceSnapshot = parsed.snapshot;
  appendLog(
    state,
    buildEvent(
      'telemetry.workforce.kpi.v1',
      `Workforce KPIs updated for tick ${String(parsed.snapshot.simTimeHours)}.`
    ),
    config.maxLogEntries
  );
}

function handleWorkforceWarnings(state: MonitorState, payload: unknown, config: RenderConfig): void {
  const parsed = z
    .object({
      warnings: z.array(workforceWarningSchema),
    })
    .parse(payload);

  state.workforceWarnings = parsed.warnings.slice();
  appendLog(
    state,
    buildEvent(
      'telemetry.workforce.warning.v1',
      `${String(parsed.warnings.length)} workforce warning(s) received.`
    ),
    config.maxLogEntries
  );
}

function handlePestDiseaseWarnings(state: MonitorState, payload: unknown, config: RenderConfig): void {
  const parsed = z
    .object({
      warnings: z.array(pestDiseaseWarningSchema),
    })
    .parse(payload);

  for (const warning of parsed.warnings) {
    state.pestWarnings.set(warning.zoneId, warning);
  }

  appendLog(
    state,
    buildEvent(
      'telemetry.health.pest_disease.risk.v1',
      `${String(parsed.warnings.length)} pest & disease warning(s) updated.`
    ),
    config.maxLogEntries
  );
}

function handlePestDiseaseTasks(state: MonitorState, payload: unknown, config: RenderConfig): void {
  const parsed = z
    .object({
      events: z.array(pestDiseaseTaskEventSchema),
    })
    .parse(payload);

  state.pestTaskEvents = [...state.pestTaskEvents, ...parsed.events].slice(-MAX_PEST_TASK_EVENTS);
  appendLog(
    state,
    buildEvent(
      'telemetry.health.pest_disease.task_emitted.v1',
      `${String(parsed.events.length)} pest & disease task event(s) emitted.`
    ),
    config.maxLogEntries
  );
}

function handleMaintenanceScheduled(state: MonitorState, payload: unknown, config: RenderConfig): void {
  const parsed = maintenanceScheduledSchema.parse(payload);
  state.maintenanceScheduled.set(parsed.taskId, parsed);
  appendLog(
    state,
    buildEvent(
      'telemetry.device.maintenance.scheduled.v1',
      `Maintenance scheduled (${parsed.reason}) for device ${parsed.deviceId}.`
    ),
    config.maxLogEntries
  );
}

function handleMaintenanceReplacement(state: MonitorState, payload: unknown, config: RenderConfig): void {
  const parsed = maintenanceReplacementSchema.parse(payload);
  state.maintenanceReplacements.set(parsed.deviceId, parsed);
  appendLog(
    state,
    buildEvent(
      'telemetry.device.replacement.recommended.v1',
      `Replacement recommended for device ${parsed.deviceId}.`
    ),
    config.maxLogEntries
  );
}

function handlePayrollSnapshot(state: MonitorState, payload: unknown, config: RenderConfig): void {
  const parsed = z
    .object({
      snapshot: workforcePayrollSnapshotSchema,
    })
    .parse(payload);

  state.payrollSnapshot = parsed.snapshot;
  appendLog(
    state,
    buildEvent(
      'telemetry.workforce.payroll_snapshot.v1',
      `Payroll snapshot updated for day ${String(parsed.snapshot.dayIndex)}.`
    ),
    config.maxLogEntries
  );
}

function handleGenericEvent(state: MonitorState, message: TelemetryMessage, config: RenderConfig): void {
  appendLog(state, buildEvent(message.topic, 'Telemetry event received.'), config.maxLogEntries);
}

function buildEvent(topic: string, summary: string): MonitorEventLogEntry {
  return { topic, summary } satisfies MonitorEventLogEntry;
}

function formatWarning(warning: WorkforceWarning): string {
  const severity = warning.severity.toUpperCase();
  const tick = String(warning.simTimeHours);
  return `[${severity}] T${tick} ${warning.message}`;
}

function formatPestWarning(warning: PestDiseaseWarning): string {
  const tick = String(warning.tick);
  return `T${tick} • Zone ${warning.zoneId} → ${warning.riskLevel} (${warning.risk01.toFixed(2)})`;
}

function formatMaintenanceSummary(entry: MaintenanceScheduledEvent): string {
  const hours = entry.serviceHours.toFixed(2);
  const cost = entry.serviceVisitCostCc.toFixed(2);
  return `Task ${entry.taskId.slice(0, SUMMARY_ID_PREFIX_LENGTH)} • ${entry.reason} • ${hours} h • ${cost} cc`;
}

function formatReplacementSummary(entry: MaintenanceReplacementEvent): string {
  const total = entry.totalMaintenanceCostCc.toFixed(2);
  const replacement = entry.replacementCostCc.toFixed(2);
  return `Device ${entry.deviceId.slice(0, SUMMARY_ID_PREFIX_LENGTH)} • maintenance ${total} cc • replacement ${replacement} cc`;
}

export function buildView(state: MonitorState): MonitorViewModel {
  const workforceWarnings = state.workforceWarnings.map(formatWarning);
  const workforceSnapshot = state.workforceSnapshot;

  const workforceView: WorkforcePanelView = {
    lastUpdatedTick: workforceSnapshot?.simTimeHours,
    queueDepth: workforceSnapshot?.queueDepth,
    tasksCompleted: workforceSnapshot?.tasksCompleted,
    utilizationPercent:
      workforceSnapshot !== undefined ? Number((workforceSnapshot.utilization01 * 100).toFixed(2)) : undefined,
    laborHoursCommitted: workforceSnapshot?.laborHoursCommitted,
    overtimeHoursCommitted: workforceSnapshot?.overtimeHoursCommitted,
    overtimeMinutes: workforceSnapshot?.overtimeMinutes,
    maintenanceBacklog: workforceSnapshot?.maintenanceBacklog,
    moralePercent:
      workforceSnapshot !== undefined ? Number((workforceSnapshot.averageMorale01 * 100).toFixed(2)) : undefined,
    fatiguePercent:
      workforceSnapshot !== undefined ? Number((workforceSnapshot.averageFatigue01 * 100).toFixed(2)) : undefined,
    p95WaitTimeHours: workforceSnapshot?.p95WaitTimeHours,
    warnings: workforceWarnings,
  } satisfies WorkforcePanelView;

  const pestWarnings = Array.from(state.pestWarnings.values());
  const highestRisk = pestWarnings.reduce<PestDiseaseWarning | undefined>((candidate, warning) => {
    if (!candidate || warning.risk01 > candidate.risk01) {
      return warning;
    }
    return candidate;
  }, undefined);

  const healthNotes = pestWarnings.slice(-MAX_HEALTH_NOTES).map(formatPestWarning);

  const healthView: HealthPanelView = {
    warningCount: pestWarnings.length,
    highestRiskLevel: highestRisk?.riskLevel,
    highestRisk01: highestRisk?.risk01,
    notes: healthNotes,
  } satisfies HealthPanelView;

  const scheduledTasks = Array.from(state.maintenanceScheduled.values());
  const replacements = Array.from(state.maintenanceReplacements.values());
  const totalServiceHours = scheduledTasks.reduce((total, entry) => total + entry.serviceHours, 0);
  const totalVisitCostCc = scheduledTasks.reduce((total, entry) => total + entry.serviceVisitCostCc, 0);

  const maintenanceView: MaintenancePanelView = {
    scheduledCount: scheduledTasks.length,
    totalServiceHours: Number(totalServiceHours.toFixed(2)),
    totalVisitCostCc: Number(totalVisitCostCc.toFixed(2)),
    replacementCount: replacements.length,
    scheduledSummaries: scheduledTasks
      .sort((a, b) => b.startTick - a.startTick)
      .slice(0, MAX_MAINTENANCE_SUMMARIES)
      .map(formatMaintenanceSummary),
    replacementSummaries: replacements
      .sort((a, b) => b.recommendedSinceTick - a.recommendedSinceTick)
      .slice(0, MAX_MAINTENANCE_SUMMARIES)
      .map(formatReplacementSummary),
  } satisfies MaintenancePanelView;

  const payroll = state.payrollSnapshot;
  let laborCostPerHourCc: number | undefined;
  let baseCostPerHourCc: number | undefined;
  let overtimeCostPerHourCc: number | undefined;

  if (payroll) {
    const baseHours = payroll.totals.baseMinutes / 60;
    const overtimeHours = payroll.totals.otMinutes / 60;
    const totalHours = baseHours + overtimeHours;

    if (totalHours > 0) {
      laborCostPerHourCc = Number(
        (payroll.totals.totalLaborCost / totalHours).toFixed(COST_PRECISION_DECIMALS)
      );
    }

    if (baseHours > 0) {
      baseCostPerHourCc = Number((payroll.totals.baseCost / baseHours).toFixed(COST_PRECISION_DECIMALS));
    }

    if (overtimeHours > 0) {
      overtimeCostPerHourCc = Number(
        (payroll.totals.otCost / overtimeHours).toFixed(COST_PRECISION_DECIMALS)
      );
    }
  }

  const economyView: EconomyPanelView = {
    dayIndex: payroll?.dayIndex,
    laborCostPerHourCc,
    baseCostPerHourCc,
    overtimeCostPerHourCc,
  } satisfies EconomyPanelView;

  const energyView: EnergyPanelView = {
    status: state.energyStatus,
  } satisfies EnergyPanelView;

  return {
    connection: state.connection,
    statusMessage: state.statusMessage,
    targetUrl: state.targetUrl,
    workforce: workforceView,
    health: healthView,
    maintenance: maintenanceView,
    economy: economyView,
    energy: energyView,
    events: state.events,
    errors: state.errors,
  } satisfies MonitorViewModel;
}

export function handleTelemetryMessage(state: MonitorState, message: TelemetryMessage, config: RenderConfig): void {
  switch (message.topic) {
    case 'telemetry.workforce.kpi.v1':
      handleWorkforceKpi(state, message.payload, config);
      return;
    case 'telemetry.workforce.warning.v1':
      handleWorkforceWarnings(state, message.payload, config);
      return;
    case 'telemetry.health.pest_disease.risk.v1':
      handlePestDiseaseWarnings(state, message.payload, config);
      return;
    case 'telemetry.health.pest_disease.task_emitted.v1':
      handlePestDiseaseTasks(state, message.payload, config);
      return;
    case 'telemetry.device.maintenance.scheduled.v1':
      handleMaintenanceScheduled(state, message.payload, config);
      return;
    case 'telemetry.device.replacement.recommended.v1':
      handleMaintenanceReplacement(state, message.payload, config);
      return;
    case 'telemetry.workforce.payroll_snapshot.v1':
      handlePayrollSnapshot(state, message.payload, config);
      return;
    default:
      handleGenericEvent(state, message, config);
  }
}
