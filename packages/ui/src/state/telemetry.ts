import { create } from "zustand";

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
  readonly setTickCompleted: (payload: TelemetryTickCompletedPayload) => void;
  readonly setZoneSnapshot: (payload: TelemetryZoneSnapshotPayload) => void;
  readonly setWorkforceKpi: (snapshot: WorkforceKpiTelemetrySnapshot) => void;
  readonly addHarvestEvent: (payload: TelemetryHarvestCreatedPayload) => void;
  readonly clearHarvestEvents: () => void;
}

const createInitialHarvestEvents = (): readonly TelemetryHarvestCreatedPayload[] => [];

export const useTelemetryStore = create<TelemetryStore>((set) => ({
  tickCompleted: null,
  zoneSnapshots: new Map<string, TelemetryZoneSnapshotPayload>(),
  workforceKpi: null,
  harvestEvents: createInitialHarvestEvents(),
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

export function resetTelemetryStore(): void {
  useTelemetryStore.setState(() => ({
    tickCompleted: null,
    zoneSnapshots: new Map<string, TelemetryZoneSnapshotPayload>(),
    workforceKpi: null,
    harvestEvents: createInitialHarvestEvents()
  }));
}
