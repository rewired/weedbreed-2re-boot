import { afterEach, describe, expect, it } from "vitest";
import {
  appendHarvestCreated,
  clearHarvestTelemetry,
  recordTickCompleted,
  recordWorkforceKpi,
  recordZoneSnapshot,
  resetTelemetryStore,
  useTelemetryStore
} from "@ui/state/telemetry";

const SAMPLE_ZONE_ID = "zone-telemetry-test";
const SAMPLE_TICK_SIM_TIME = 42.5;
const SAMPLE_TARGET_TICKS = 30;
const SAMPLE_ACTUAL_TICKS = 29;
const SAMPLE_OPERATING_COST = 120;
const SAMPLE_LABOUR_COST = 45;
const SAMPLE_UTILITIES_COST = 32;
const SAMPLE_ZONE_SIM_TIME = 42;
const SAMPLE_PPFD = 520;
const SAMPLE_DLI = 32;
const SAMPLE_TEMPERATURE = 24.5;
const SAMPLE_RELATIVE_HUMIDITY = 0.58;
const SAMPLE_CO2 = 810;
const SAMPLE_ACH = 5.6;
const SAMPLE_TASKS_COMPLETED = 18;
const SAMPLE_QUEUE_DEPTH = 2;
const SAMPLE_LABOR_HOURS = 24;
const SAMPLE_OVERTIME_HOURS = 4;
const SAMPLE_OVERTIME_MINUTES = 45;
const SAMPLE_UTILISATION = 0.82;
const SAMPLE_WAIT_TIME = 1.5;
const SAMPLE_MAINTENANCE_BACKLOG = 1;
const SAMPLE_MORALE = 0.74;
const SAMPLE_FATIGUE = 0.33;
const SAMPLE_FRESH_WEIGHT = 18.5;
const SAMPLE_MOISTURE = 0.62;
const SAMPLE_QUALITY = 0.88;

function createSampleTick() {
  return {
    simTimeHours: SAMPLE_TICK_SIM_TIME,
    targetTicksPerHour: SAMPLE_TARGET_TICKS,
    actualTicksPerHour: SAMPLE_ACTUAL_TICKS,
    operatingCostPerHour: SAMPLE_OPERATING_COST,
    labourCostPerHour: SAMPLE_LABOUR_COST,
    utilitiesCostPerHour: SAMPLE_UTILITIES_COST
  } as const;
}

function createSampleZoneSnapshot() {
  return {
    zoneId: SAMPLE_ZONE_ID,
    simTime: SAMPLE_ZONE_SIM_TIME,
    ppfd: SAMPLE_PPFD,
    dli_incremental: SAMPLE_DLI,
    temp_c: SAMPLE_TEMPERATURE,
    relativeHumidity01: SAMPLE_RELATIVE_HUMIDITY,
    co2_ppm: SAMPLE_CO2,
    ach: SAMPLE_ACH,
    warnings: [
      {
        code: "Z_TEMP_HIGH",
        message: "Temperature trending high",
        severity: "warning" as const
      }
    ]
  } as const;
}

function createSampleKpi() {
  return {
    simTimeHours: SAMPLE_ZONE_SIM_TIME,
    tasksCompleted: SAMPLE_TASKS_COMPLETED,
    queueDepth: SAMPLE_QUEUE_DEPTH,
    laborHoursCommitted: SAMPLE_LABOR_HOURS,
    overtimeHoursCommitted: SAMPLE_OVERTIME_HOURS,
    overtimeMinutes: SAMPLE_OVERTIME_MINUTES,
    utilization01: SAMPLE_UTILISATION,
    p95WaitTimeHours: SAMPLE_WAIT_TIME,
    maintenanceBacklog: SAMPLE_MAINTENANCE_BACKLOG,
    averageMorale01: SAMPLE_MORALE,
    averageFatigue01: SAMPLE_FATIGUE
  } as const;
}

function createSampleHarvestEvent() {
  return {
    structureId: "structure-1",
    roomId: "room-1",
    plantId: "plant-1",
    zoneId: SAMPLE_ZONE_ID,
    lotId: "lot-1",
    createdAt_tick: SAMPLE_ZONE_SIM_TIME,
    freshWeight_kg: SAMPLE_FRESH_WEIGHT,
    moisture01: SAMPLE_MOISTURE,
    quality01: SAMPLE_QUALITY
  } as const;
}

describe("telemetry store", () => {
  afterEach(() => {
    resetTelemetryStore();
  });

  it("provides an empty initial state", () => {
    const state = useTelemetryStore.getState();
    expect(state.tickCompleted).toBeNull();
    expect(state.zoneSnapshots.size).toBe(0);
    expect(state.workforceKpi).toBeNull();
    expect(state.harvestEvents).toHaveLength(0);
  });

  it("records the most recent tick telemetry", () => {
    const tick = createSampleTick();
    recordTickCompleted(tick);

    expect(useTelemetryStore.getState().tickCompleted).toEqual(tick);
  });

  it("stores zone snapshots keyed by zone id", () => {
    const snapshot = createSampleZoneSnapshot();
    recordZoneSnapshot(snapshot);

    const stored = useTelemetryStore.getState().zoneSnapshots.get(SAMPLE_ZONE_ID);
    expect(stored).toEqual(snapshot);
  });

  it("persists the most recent workforce KPI snapshot", () => {
    const kpi = createSampleKpi();
    recordWorkforceKpi(kpi);

    expect(useTelemetryStore.getState().workforceKpi).toEqual(kpi);
  });

  it("appends and clears harvest telemetry events", () => {
    const first = createSampleHarvestEvent();
    const second = { ...first, lotId: "lot-2" } as const;

    appendHarvestCreated(first);
    appendHarvestCreated(second);

    const state = useTelemetryStore.getState();
    expect(state.harvestEvents).toHaveLength(2);
    expect(state.harvestEvents[0]).toEqual(first);
    expect(state.harvestEvents[1]).toEqual(second);

    clearHarvestTelemetry();
    expect(useTelemetryStore.getState().harvestEvents).toHaveLength(0);
  });
});
