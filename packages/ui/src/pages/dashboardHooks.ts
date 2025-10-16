import { useMemo } from "react";
import { useTelemetryTick } from "@ui/state/telemetry";
import { DEFAULT_SIMULATION_CLOCK, deriveSimulationClock } from "@ui/lib/simTime";

const DASHBOARD_STUB_TARGET_TICKS_PER_HOUR = 30;
const DASHBOARD_STUB_ACTUAL_TICKS_PER_HOUR = 28;
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

const stubSnapshot: DashboardSnapshot = Object.freeze({
  tickRate: {
    targetTicksPerHour: DASHBOARD_STUB_TARGET_TICKS_PER_HOUR,
    actualTicksPerHour: DASHBOARD_STUB_ACTUAL_TICKS_PER_HOUR
  },
  clock: {
    ...DEFAULT_SIMULATION_CLOCK
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

export function useDashboardSnapshot(): DashboardSnapshot {
  const tickTelemetry = useTelemetryTick();

  return useMemo(() => {
    if (!tickTelemetry) {
      return stubSnapshot;
    }

    const clock = deriveSimulationClock(tickTelemetry.simTimeHours, stubSnapshot.clock);

    return {
      tickRate: {
        targetTicksPerHour:
          tickTelemetry.targetTicksPerHour ?? stubSnapshot.tickRate.targetTicksPerHour,
        actualTicksPerHour:
          tickTelemetry.actualTicksPerHour ?? stubSnapshot.tickRate.actualTicksPerHour
      },
      clock,
      costs: {
        operatingCostPerHour:
          tickTelemetry.operatingCostPerHour ?? stubSnapshot.costs.operatingCostPerHour,
        labourCostPerHour:
          tickTelemetry.labourCostPerHour ?? stubSnapshot.costs.labourCostPerHour,
        utilitiesCostPerHour:
          tickTelemetry.utilitiesCostPerHour ?? stubSnapshot.costs.utilitiesCostPerHour
      },
      resources: {
        energyKwhPerDay:
          tickTelemetry.energyKwhPerDay ?? stubSnapshot.resources.energyKwhPerDay,
        energyCostPerHour:
          tickTelemetry.energyCostPerHour ?? stubSnapshot.resources.energyCostPerHour,
        waterCubicMetersPerDay:
          tickTelemetry.waterCubicMetersPerDay ?? stubSnapshot.resources.waterCubicMetersPerDay,
        waterCostPerHour:
          tickTelemetry.waterCostPerHour ?? stubSnapshot.resources.waterCostPerHour
      },
      events: stubSnapshot.events
    } satisfies DashboardSnapshot;
  }, [tickTelemetry]);
}
