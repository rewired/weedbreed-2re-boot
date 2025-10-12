import { create } from "zustand";

export type TelemetryConnectionStatus = "disconnected" | "connecting" | "connected";

export interface TelemetryTickCompletedPayload {
  readonly simTimeHours: number;
  readonly targetTicksPerHour?: number;
  readonly actualTicksPerHour?: number;
  readonly operatingCostPerHour?: number;
  readonly labourCostPerHour?: number;
  readonly utilitiesCostPerHour?: number;
  readonly energyKwhPerDay?: number;
  readonly energyCostPerHour?: number;
  readonly waterCubicMetersPerDay?: number;
  readonly waterCostPerHour?: number;
}

export interface TelemetryZoneSnapshotWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "critical";
}

export interface TelemetryZoneSnapshotPayload {
  readonly zoneId: string;
  readonly simTime: number;
  readonly ppfd: number;
  readonly dli_incremental: number;
  readonly temp_c: number;
  readonly rh: number;
  readonly co2_ppm: number;
  readonly ach: number;
  readonly warnings: readonly TelemetryZoneSnapshotWarning[];
}

export interface TelemetryHarvestCreatedPayload {
  readonly structureId: string;
  readonly roomId: string;
  readonly plantId: string;
  readonly zoneId: string;
  readonly lotId: string;
  readonly createdAt_tick: number;
  readonly freshWeight_kg: number;
  readonly moisture01: number;
  readonly quality01: number;
}

export interface WorkforceKpiTelemetrySnapshot {
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

interface TelemetryStore {
  readonly tickCompleted: TelemetryTickCompletedPayload | null;
  readonly zoneSnapshots: Map<string, TelemetryZoneSnapshotPayload>;
  readonly workforceKpi: WorkforceKpiTelemetrySnapshot | null;
  readonly harvestEvents: readonly TelemetryHarvestCreatedPayload[];
  readonly connectionStatus: TelemetryConnectionStatus;
  readonly lastDisconnectReason: string | null;
  readonly setTickCompleted: (payload: TelemetryTickCompletedPayload) => void;
  readonly setZoneSnapshot: (payload: TelemetryZoneSnapshotPayload) => void;
  readonly setWorkforceKpi: (snapshot: WorkforceKpiTelemetrySnapshot) => void;
  readonly addHarvestEvent: (payload: TelemetryHarvestCreatedPayload) => void;
  readonly clearHarvestEvents: () => void;
  readonly clearTelemetrySnapshots: () => void;
  readonly markConnecting: () => void;
  readonly markConnected: () => void;
  readonly markDisconnected: (reason?: string) => void;
}

const createInitialHarvestEvents = (): readonly TelemetryHarvestCreatedPayload[] => [];

const createInitialZoneSnapshots = (): Map<string, TelemetryZoneSnapshotPayload> =>
  new Map<string, TelemetryZoneSnapshotPayload>();

const createInitialTelemetrySnapshots = () => ({
  tickCompleted: null as TelemetryTickCompletedPayload | null,
  zoneSnapshots: createInitialZoneSnapshots(),
  workforceKpi: null as WorkforceKpiTelemetrySnapshot | null,
  harvestEvents: createInitialHarvestEvents()
});

const INITIAL_CONNECTION_STATUS: TelemetryConnectionStatus = "disconnected";

export const useTelemetryStore = create<TelemetryStore>((set) => ({
  ...createInitialTelemetrySnapshots(),
  connectionStatus: INITIAL_CONNECTION_STATUS,
  lastDisconnectReason: null,
  setTickCompleted: (payload) => {
    set(() => ({ tickCompleted: { ...payload } }));
  },
  setZoneSnapshot: (payload) => {
    set((state) => {
      const next = new Map(state.zoneSnapshots);
      next.set(payload.zoneId, { ...payload, warnings: [...payload.warnings] });
      return { zoneSnapshots: next };
    });
  },
  setWorkforceKpi: (snapshot) => {
    set(() => ({ workforceKpi: { ...snapshot } }));
  },
  addHarvestEvent: (payload) => {
    set((state) => ({
      harvestEvents: [...state.harvestEvents, { ...payload }]
    }));
  },
  clearHarvestEvents: () => {
    set(() => ({ harvestEvents: createInitialHarvestEvents() }));
  },
  clearTelemetrySnapshots: () => {
    set(() => ({
      ...createInitialTelemetrySnapshots()
    }));
  },
  markConnecting: () => {
    set(() => ({ connectionStatus: "connecting", lastDisconnectReason: null }));
  },
  markConnected: () => {
    set(() => ({ connectionStatus: "connected", lastDisconnectReason: null }));
  },
  markDisconnected: (reason) => {
    set(() => ({
      connectionStatus: "disconnected",
      lastDisconnectReason: typeof reason === "string" ? reason : null
    }));
  }
}));

export function useTelemetryTick(): TelemetryTickCompletedPayload | null {
  return useTelemetryStore((state) => state.tickCompleted);
}

export function useZoneSnapshot(zoneId?: string | null): TelemetryZoneSnapshotPayload | null {
  return useTelemetryStore((state) => (zoneId ? state.zoneSnapshots.get(zoneId) ?? null : null));
}

export function useWorkforceKpiTelemetry(): WorkforceKpiTelemetrySnapshot | null {
  return useTelemetryStore((state) => state.workforceKpi);
}

export function useHarvestTelemetry(): readonly TelemetryHarvestCreatedPayload[] {
  return useTelemetryStore((state) => state.harvestEvents);
}

export interface TelemetryConnectionSnapshot {
  readonly status: TelemetryConnectionStatus;
  readonly lastDisconnectReason: string | null;
}

export function useTelemetryConnection(): TelemetryConnectionSnapshot {
  return useTelemetryStore((state) => ({
    status: state.connectionStatus,
    lastDisconnectReason: state.lastDisconnectReason
  }));
}

export function recordTickCompleted(payload: TelemetryTickCompletedPayload): void {
  useTelemetryStore.getState().setTickCompleted(payload);
}

export function recordZoneSnapshot(payload: TelemetryZoneSnapshotPayload): void {
  useTelemetryStore.getState().setZoneSnapshot(payload);
}

export function recordWorkforceKpi(snapshot: WorkforceKpiTelemetrySnapshot): void {
  useTelemetryStore.getState().setWorkforceKpi(snapshot);
}

export function appendHarvestCreated(payload: TelemetryHarvestCreatedPayload): void {
  useTelemetryStore.getState().addHarvestEvent(payload);
}

export function clearHarvestTelemetry(): void {
  useTelemetryStore.getState().clearHarvestEvents();
}

export function clearTelemetrySnapshots(): void {
  useTelemetryStore.getState().clearTelemetrySnapshots();
}

export function markTelemetryConnecting(): void {
  useTelemetryStore.getState().markConnecting();
}

export function markTelemetryConnected(): void {
  useTelemetryStore.getState().markConnected();
}

export function markTelemetryDisconnected(reason?: string): void {
  useTelemetryStore.getState().markDisconnected(reason);
}

export function resetTelemetryStore(): void {
  useTelemetryStore.setState(() => ({
    ...createInitialTelemetrySnapshots(),
    connectionStatus: INITIAL_CONNECTION_STATUS,
    lastDisconnectReason: null
  }));
}
