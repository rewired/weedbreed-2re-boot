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
