import { useSyncExternalStore } from "react";

const DASHBOARD_STUB_TARGET_TICKS_PER_HOUR = 30;
const DASHBOARD_STUB_ACTUAL_TICKS_PER_HOUR = 28;
const DASHBOARD_STUB_DAY = 12;
const DASHBOARD_STUB_HOUR = 6;
const DASHBOARD_STUB_MINUTE = 15;
const DASHBOARD_STUB_OPERATING_COST_PER_HOUR = 126.5;
const DASHBOARD_STUB_LABOUR_COST_PER_HOUR = 48.25;
const DASHBOARD_STUB_UTILITIES_COST_PER_HOUR = 32.1;
const DASHBOARD_STUB_ENERGY_KWH_PER_DAY = 480;
const DASHBOARD_STUB_ENERGY_COST_PER_HOUR = 28.8;
const DASHBOARD_STUB_WATER_CUBIC_METERS_PER_DAY = 12;
const DASHBOARD_STUB_WATER_COST_PER_HOUR = 3.4;

export interface DashboardTickRate {
  readonly targetTicksPerHour: number;
  readonly actualTicksPerHour: number;
}

export interface DashboardClockSnapshot {
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

export interface DashboardCostRollup {
  readonly operatingCostPerHour: number;
  readonly labourCostPerHour: number;
  readonly utilitiesCostPerHour: number;
}

export interface DashboardResourceUsage {
  readonly energyKwhPerDay: number;
  readonly energyCostPerHour: number;
  readonly waterCubicMetersPerDay: number;
  readonly waterCostPerHour: number;
}

export interface DashboardEventSnapshot {
  readonly id: string;
  readonly label: string;
  readonly relativeTime: string;
}

export interface DashboardSnapshot {
  readonly tickRate: DashboardTickRate;
  readonly clock: DashboardClockSnapshot;
  readonly costs: DashboardCostRollup;
  readonly resources: DashboardResourceUsage;
  readonly events: readonly DashboardEventSnapshot[];
}

export interface DashboardStore {
  getSnapshot(): DashboardSnapshot;
  subscribe(listener: () => void): () => void;
}

const stubSnapshot: DashboardSnapshot = Object.freeze({
  tickRate: {
    targetTicksPerHour: DASHBOARD_STUB_TARGET_TICKS_PER_HOUR,
    actualTicksPerHour: DASHBOARD_STUB_ACTUAL_TICKS_PER_HOUR
  },
  clock: {
    day: DASHBOARD_STUB_DAY,
    hour: DASHBOARD_STUB_HOUR,
    minute: DASHBOARD_STUB_MINUTE
  },
  costs: {
    operatingCostPerHour: DASHBOARD_STUB_OPERATING_COST_PER_HOUR,
    labourCostPerHour: DASHBOARD_STUB_LABOUR_COST_PER_HOUR,
    utilitiesCostPerHour: DASHBOARD_STUB_UTILITIES_COST_PER_HOUR
  },
  resources: {
    energyKwhPerDay: DASHBOARD_STUB_ENERGY_KWH_PER_DAY,
    energyCostPerHour: DASHBOARD_STUB_ENERGY_COST_PER_HOUR,
    waterCubicMetersPerDay: DASHBOARD_STUB_WATER_CUBIC_METERS_PER_DAY,
    waterCostPerHour: DASHBOARD_STUB_WATER_COST_PER_HOUR
  },
  events: Object.freeze([
    { id: "evt-01", label: "Lights schedule change staged", relativeTime: "T+00:15" },
    { id: "evt-02", label: "Nutrient solution top-off planned", relativeTime: "T+00:40" },
    { id: "evt-03", label: "Harvest readiness review queued", relativeTime: "T+01:05" }
  ])
});

const dashboardStore: DashboardStore = {
  getSnapshot: () => stubSnapshot,
  subscribe: (listener: () => void) => {
    void listener;
    return () => undefined;
  }
};

export function useDashboardSnapshot(): DashboardSnapshot {
  return useSyncExternalStore(
    (listener) => dashboardStore.subscribe(listener),
    () => dashboardStore.getSnapshot(),
    () => dashboardStore.getSnapshot()
  );
}
