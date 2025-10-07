import { z, ZodError } from 'zod';

export type TelemetryConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface TelemetryMessage {
  readonly topic: string;
  readonly payload: unknown;
}

export interface TelemetryClientEventMap {
  readonly connect: () => void;
  readonly disconnect: () => void;
  readonly event: (message: TelemetryMessage) => void;
  readonly error: (error: unknown) => void;
}

export interface TelemetryClient {
  connect(): void;
  disconnect(): Promise<void>;
  on<E extends keyof TelemetryClientEventMap>(event: E, handler: TelemetryClientEventMap[E]): void;
  off<E extends keyof TelemetryClientEventMap>(event: E, handler: TelemetryClientEventMap[E]): void;
}

export interface WorkforcePanelView {
  readonly lastUpdatedTick?: number;
  readonly queueDepth?: number;
  readonly tasksCompleted?: number;
  readonly utilizationPercent?: number;
  readonly laborHoursCommitted?: number;
  readonly overtimeHoursCommitted?: number;
  readonly overtimeMinutes?: number;
  readonly maintenanceBacklog?: number;
  readonly moralePercent?: number;
  readonly fatiguePercent?: number;
  readonly p95WaitTimeHours?: number;
  readonly warnings: readonly string[];
}

export interface HealthPanelView {
  readonly warningCount: number;
  readonly highestRiskLevel?: string;
  readonly highestRisk01?: number;
  readonly notes: readonly string[];
}

export interface MaintenancePanelView {
  readonly scheduledCount: number;
  readonly totalServiceHours: number;
  readonly totalVisitCostCc: number;
  readonly replacementCount: number;
  readonly scheduledSummaries: readonly string[];
  readonly replacementSummaries: readonly string[];
}

export interface EconomyPanelView {
  readonly dayIndex?: number;
  readonly laborCostPerHourCc?: number;
  readonly baseCostPerHourCc?: number;
  readonly overtimeCostPerHourCc?: number;
}

export interface EnergyPanelView {
  readonly status: string;
}

export interface MonitorEventLogEntry {
  readonly topic: string;
  readonly summary: string;
}

export interface MonitorViewModel {
  readonly connection: TelemetryConnectionState;
  readonly statusMessage: string;
  readonly targetUrl: string;
  readonly workforce: WorkforcePanelView;
  readonly health: HealthPanelView;
  readonly maintenance: MaintenancePanelView;
  readonly economy: EconomyPanelView;
  readonly energy: EnergyPanelView;
  readonly events: readonly MonitorEventLogEntry[];
  readonly errors: readonly string[];
}

export interface MonitorUi {
  initialize(): void;
  render(view: MonitorViewModel): void;
  destroy(): void;
}

export interface MonitorRuntimeOptions {
  readonly telemetryClient: TelemetryClient;
  readonly ui: MonitorUi;
  readonly targetUrl: string;
  readonly refreshIntervalMs?: number;
  readonly maxLogEntries?: number;
  readonly maxErrorEntries?: number;
}

export interface MonitorRuntime {
  start(): void;
  stop(): Promise<void>;
}

const workforceKpiSnapshotSchema = z.object({
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
});

const workforceWarningSchema = z.object({
  simTimeHours: z.number().finite(),
  code: z.string(),
  message: z.string(),
  severity: z.union([z.literal('info'), z.literal('warning'), z.literal('critical')]),
  structureId: z.string().optional(),
  employeeId: z.string().optional(),
  taskId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const pestDiseaseWarningSchema = z.object({
  structureId: z.string(),
  roomId: z.string(),
  zoneId: z.string(),
  riskLevel: z.string(),
  risk01: z.number().min(0).max(1),
  tick: z.number().finite(),
});

const pestDiseaseTaskEventSchema = z.object({
  taskId: z.string(),
  taskCode: z.string(),
  structureId: z.string(),
  roomId: z.string(),
  zoneId: z.string(),
  tick: z.number().finite(),
  riskLevel: z.string(),
  risk01: z.number().min(0).max(1),
});

const maintenanceScheduledSchema = z.object({
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
});

const maintenanceReplacementSchema = z.object({
  deviceId: z.string(),
  structureId: z.string().optional(),
  roomId: z.string().optional(),
  zoneId: z.string().optional(),
  recommendedSinceTick: z.number().finite(),
  totalMaintenanceCostCc: z.number().min(0).finite(),
  replacementCostCc: z.number().min(0).finite(),
});

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

const workforcePayrollSnapshotSchema = z.object({
  dayIndex: z.number().int().min(0),
  totals: workforcePayrollTotalsSchema,
  byStructure: z.array(workforceStructurePayrollTotalsSchema).readonly(),
});

type WorkforceKpiSnapshot = z.infer<typeof workforceKpiSnapshotSchema>;
type WorkforceWarning = z.infer<typeof workforceWarningSchema>;
type PestDiseaseWarning = z.infer<typeof pestDiseaseWarningSchema>;
type PestDiseaseTaskEvent = z.infer<typeof pestDiseaseTaskEventSchema>;
type MaintenanceScheduledEvent = z.infer<typeof maintenanceScheduledSchema>;
type MaintenanceReplacementEvent = z.infer<typeof maintenanceReplacementSchema>;
type WorkforcePayrollSnapshot = z.infer<typeof workforcePayrollSnapshotSchema>;

interface MonitorState {
  connection: TelemetryConnectionState;
  statusMessage: string;
  workforceSnapshot?: WorkforceKpiSnapshot;
  workforceWarnings: WorkforceWarning[];
  pestWarnings: Map<string, PestDiseaseWarning>;
  pestTaskEvents: PestDiseaseTaskEvent[];
  maintenanceScheduled: Map<string, MaintenanceScheduledEvent>;
  maintenanceReplacements: Map<string, MaintenanceReplacementEvent>;
  payrollSnapshot?: WorkforcePayrollSnapshot;
  events: MonitorEventLogEntry[];
  errors: string[];
  readonly targetUrl: string;
  readonly energyStatus: string;
}

interface RenderConfig {
  readonly maxLogEntries: number;
  readonly maxErrorEntries: number;
}

function appendLog(state: MonitorState, entry: MonitorEventLogEntry, maxEntries: number): void {
  state.events = [...state.events, entry];
  if (state.events.length > maxEntries) {
    state.events = state.events.slice(-maxEntries);
  }
}

function recordError(state: MonitorState, message: string, maxEntries: number): void {
  state.errors = [...state.errors, message];
  if (state.errors.length > maxEntries) {
    state.errors = state.errors.slice(-maxEntries);
  }
}

function handleWorkforceKpi(
  state: MonitorState,
  payload: unknown,
  config: RenderConfig
): void {
  const parsed = z
    .object({
      snapshot: workforceKpiSnapshotSchema,
    })
    .parse(payload);

  state.workforceSnapshot = parsed.snapshot;
  appendLog(
    state,
    {
      topic: 'telemetry.workforce.kpi.v1',
      summary: `Workforce KPIs updated for tick ${String(parsed.snapshot.simTimeHours)}.`,
    },
    config.maxLogEntries
  );
}

function handleWorkforceWarnings(
  state: MonitorState,
  payload: unknown,
  config: RenderConfig
): void {
  const parsed = z
    .object({
      warnings: z.array(workforceWarningSchema),
    })
    .parse(payload);

  state.workforceWarnings = parsed.warnings.slice();
  appendLog(
    state,
    {
      topic: 'telemetry.workforce.warning.v1',
      summary: `${String(parsed.warnings.length)} workforce warning(s) received.`,
    },
    config.maxLogEntries
  );
}

function handlePestDiseaseWarnings(
  state: MonitorState,
  payload: unknown,
  config: RenderConfig
): void {
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
    {
      topic: 'telemetry.health.pest_disease.risk.v1',
      summary: `${String(parsed.warnings.length)} pest & disease warning(s) updated.`,
    },
    config.maxLogEntries
  );
}

function handlePestDiseaseTasks(
  state: MonitorState,
  payload: unknown,
  config: RenderConfig
): void {
  const parsed = z
    .object({
      events: z.array(pestDiseaseTaskEventSchema),
    })
    .parse(payload);

  state.pestTaskEvents = [...state.pestTaskEvents, ...parsed.events].slice(-25);
  appendLog(
    state,
    {
      topic: 'telemetry.health.pest_disease.task_emitted.v1',
      summary: `${String(parsed.events.length)} pest & disease task event(s) emitted.`,
    },
    config.maxLogEntries
  );
}

function handleMaintenanceScheduled(
  state: MonitorState,
  payload: unknown,
  config: RenderConfig
): void {
  const parsed = maintenanceScheduledSchema.parse(payload);
  state.maintenanceScheduled.set(parsed.taskId, parsed);
  appendLog(
    state,
    {
      topic: 'telemetry.device.maintenance.scheduled.v1',
      summary: `Maintenance scheduled (${parsed.reason}) for device ${parsed.deviceId}.`,
    },
    config.maxLogEntries
  );
}

function handleMaintenanceReplacement(
  state: MonitorState,
  payload: unknown,
  config: RenderConfig
): void {
  const parsed = maintenanceReplacementSchema.parse(payload);
  state.maintenanceReplacements.set(parsed.deviceId, parsed);
  appendLog(
    state,
    {
      topic: 'telemetry.device.replacement.recommended.v1',
      summary: `Replacement recommended for device ${parsed.deviceId}.`,
    },
    config.maxLogEntries
  );
}

function handlePayrollSnapshot(
  state: MonitorState,
  payload: unknown,
  config: RenderConfig
): void {
  const parsed = z
    .object({
      snapshot: workforcePayrollSnapshotSchema,
    })
    .parse(payload);

  state.payrollSnapshot = parsed.snapshot;
  appendLog(
    state,
    {
      topic: 'telemetry.workforce.payroll_snapshot.v1',
      summary: `Payroll snapshot updated for day ${String(parsed.snapshot.dayIndex)}.`,
    },
    config.maxLogEntries
  );
}

function handleGenericEvent(
  state: MonitorState,
  message: TelemetryMessage,
  config: RenderConfig
): void {
  appendLog(
    state,
    {
      topic: message.topic,
      summary: 'Telemetry event received.',
    },
    config.maxLogEntries
  );
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
  return `Task ${entry.taskId.slice(0, 8)} • ${entry.reason} • ${hours} h • ${cost} cc`;
}

function formatReplacementSummary(entry: MaintenanceReplacementEvent): string {
  const total = entry.totalMaintenanceCostCc.toFixed(2);
  const replacement = entry.replacementCostCc.toFixed(2);
  return `Device ${entry.deviceId.slice(0, 8)} • maintenance ${total} cc • replacement ${replacement} cc`;
}

function buildView(state: MonitorState): MonitorViewModel {
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
  };

  const pestWarnings = Array.from(state.pestWarnings.values());
  const highestRisk = pestWarnings.reduce<PestDiseaseWarning | undefined>((candidate, warning) => {
    if (!candidate || warning.risk01 > candidate.risk01) {
      return warning;
    }
    return candidate;
  }, undefined);

  const healthNotes = pestWarnings.slice(-5).map(formatPestWarning);

  const healthView: HealthPanelView = {
    warningCount: pestWarnings.length,
    highestRiskLevel: highestRisk?.riskLevel,
    highestRisk01: highestRisk?.risk01,
    notes: healthNotes,
  };

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
      .slice(0, 5)
      .map(formatMaintenanceSummary),
    replacementSummaries: replacements
      .sort((a, b) => b.recommendedSinceTick - a.recommendedSinceTick)
      .slice(0, 5)
      .map(formatReplacementSummary),
  };

  const payroll = state.payrollSnapshot;
  let laborCostPerHourCc: number | undefined;
  let baseCostPerHourCc: number | undefined;
  let overtimeCostPerHourCc: number | undefined;

  if (payroll) {
    const baseHours = payroll.totals.baseMinutes / 60;
    const overtimeHours = payroll.totals.otMinutes / 60;
    const totalHours = baseHours + overtimeHours;

    if (totalHours > 0) {
      laborCostPerHourCc = Number((payroll.totals.totalLaborCost / totalHours).toFixed(4));
    }

    if (baseHours > 0) {
      baseCostPerHourCc = Number((payroll.totals.baseCost / baseHours).toFixed(4));
    }

    if (overtimeHours > 0) {
      overtimeCostPerHourCc = Number((payroll.totals.otCost / overtimeHours).toFixed(4));
    }
  }

  const economyView: EconomyPanelView = {
    dayIndex: payroll?.dayIndex,
    laborCostPerHourCc,
    baseCostPerHourCc,
    overtimeCostPerHourCc,
  };

  const energyView: EnergyPanelView = {
    status: state.energyStatus,
  };

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

function handleTelemetryMessage(
  state: MonitorState,
  message: TelemetryMessage,
  config: RenderConfig
): void {
  try {
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
        return;
    }
  } catch (error) {
    const reason =
      error instanceof ZodError ? error.issues.map((issue) => issue.message).join('; ') : String(error);
    recordError(state, `Failed to parse ${message.topic}: ${reason}`, config.maxErrorEntries);
  }
}

export function createMonitorRuntime(options: MonitorRuntimeOptions): MonitorRuntime {
  const { telemetryClient, ui, targetUrl } = options;
  const refreshIntervalMs = options.refreshIntervalMs ?? 1000;
  const maxLogEntries = options.maxLogEntries ?? 50;
  const maxErrorEntries = options.maxErrorEntries ?? 10;
  const config: RenderConfig = { maxLogEntries, maxErrorEntries };

  const state: MonitorState = {
    connection: 'connecting',
    statusMessage: `Connecting to ${targetUrl}`,
    workforceWarnings: [],
    pestWarnings: new Map(),
    pestTaskEvents: [],
    maintenanceScheduled: new Map(),
    maintenanceReplacements: new Map(),
    events: [],
    errors: [],
    targetUrl,
    energyStatus: 'Awaiting energy telemetry (no energy topics emitted yet).',
  };

  let started = false;
  let stopping = false;
  let refreshTimer: NodeJS.Timeout | undefined;

  const handleConnect = () => {
    state.connection = 'connected';
    state.statusMessage = `Connected to ${targetUrl}`;
    appendLog(state, { topic: 'connection', summary: 'Telemetry connection established.' }, maxLogEntries);
    renderNow();
  };

  const handleDisconnect = () => {
    state.connection = 'disconnected';
    state.statusMessage = `Disconnected from ${targetUrl}`;
    appendLog(state, { topic: 'connection', summary: 'Telemetry connection lost.' }, maxLogEntries);
    renderNow();
  };

  const handleError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    recordError(state, message, maxErrorEntries);
    renderNow();
  };

  const handleEvent = (message: TelemetryMessage) => {
    handleTelemetryMessage(state, message, config);
    renderNow();
  };

  function renderNow(): void {
    const view = buildView(state);
    ui.render(view);
  }

  return {
    start() {
      if (started) {
        return;
      }

      started = true;
      ui.initialize();
      renderNow();

      telemetryClient.on('connect', handleConnect);
      telemetryClient.on('disconnect', handleDisconnect);
      telemetryClient.on('event', handleEvent);
      telemetryClient.on('error', handleError);

      telemetryClient.connect();

      refreshTimer = setInterval(() => {
        renderNow();
      }, refreshIntervalMs);
    },
    async stop() {
      if (!started || stopping) {
        return;
      }

      stopping = true;

      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
      }

      telemetryClient.off('connect', handleConnect);
      telemetryClient.off('disconnect', handleDisconnect);
      telemetryClient.off('event', handleEvent);
      telemetryClient.off('error', handleError);

      await telemetryClient.disconnect();
      ui.destroy();
      state.connection = 'disconnected';
    },
  } satisfies MonitorRuntime;
}
