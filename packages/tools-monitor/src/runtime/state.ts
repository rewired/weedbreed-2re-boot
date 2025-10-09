import { type TelemetryConnectionState, type MonitorEventLogEntry } from './types.ts';

export interface WorkforceKpiSnapshot {
  readonly simTimeHours: number;
  readonly tasksCompleted: number;
  readonly queueDepth: number;
  readonly laborHoursCommitted: number;
  readonly overtimeHoursCommitted: number;
  readonly overtimeMinutes: number;
  readonly utilization01: number;
  readonly p95WaitTimeHours: number;
  readonly maintenanceBacklog: number;
  readonly averageMorale01: number;
  readonly averageFatigue01: number;
}

export interface WorkforceWarning {
  readonly simTimeHours: number;
  readonly code: string;
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly structureId?: string;
  readonly employeeId?: string;
  readonly taskId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface PestDiseaseWarning {
  readonly structureId: string;
  readonly roomId: string;
  readonly zoneId: string;
  readonly riskLevel: string;
  readonly risk01: number;
  readonly tick: number;
}

export interface PestDiseaseTaskEvent {
  readonly taskId: string;
  readonly taskCode: string;
  readonly structureId: string;
  readonly roomId: string;
  readonly zoneId: string;
  readonly tick: number;
  readonly riskLevel: string;
  readonly risk01: number;
}

export interface MaintenanceScheduledEvent {
  readonly taskId: string;
  readonly deviceId: string;
  readonly structureId?: string;
  readonly roomId?: string;
  readonly zoneId?: string;
  readonly startTick: number;
  readonly endTick: number;
  readonly serviceHours: number;
  readonly reason: string;
  readonly serviceVisitCostCc: number;
}

export interface MaintenanceReplacementEvent {
  readonly deviceId: string;
  readonly structureId?: string;
  readonly roomId?: string;
  readonly zoneId?: string;
  readonly recommendedSinceTick: number;
  readonly totalMaintenanceCostCc: number;
  readonly replacementCostCc: number;
}

export interface WorkforcePayrollTotals {
  readonly baseMinutes: number;
  readonly otMinutes: number;
  readonly baseCost: number;
  readonly otCost: number;
  readonly totalLaborCost: number;
}

export interface WorkforceStructurePayrollTotals extends WorkforcePayrollTotals {
  readonly structureId: string;
}

export interface WorkforcePayrollSnapshot {
  readonly dayIndex: number;
  readonly totals: WorkforcePayrollTotals;
  readonly byStructure: readonly WorkforceStructurePayrollTotals[];
}

export interface MonitorState {
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

export interface RenderConfig {
  readonly maxLogEntries: number;
  readonly maxErrorEntries: number;
}

export function createInitialMonitorState(targetUrl: string): MonitorState {
  return {
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
  } satisfies MonitorState;
}

export function appendLog(state: MonitorState, entry: MonitorEventLogEntry, maxEntries: number): void {
  state.events = [...state.events, entry];
  if (state.events.length > maxEntries) {
    state.events = state.events.slice(-maxEntries);
  }
}

export function recordError(state: MonitorState, message: string, maxEntries: number): void {
  state.errors = [...state.errors, message];
  if (state.errors.length > maxEntries) {
    state.errors = state.errors.slice(-maxEntries);
  }
}
