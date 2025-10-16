/* eslint-disable @typescript-eslint/no-magic-numbers */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ZoneDetailSnapshot } from "@ui/pages/zoneDetailHooks";
import { CAPACITY_ADVISOR_ACTION_LABEL, useZoneDetailView } from "@ui/pages/zoneDetailHooks";
import { applyReadModelSnapshot, resetReadModelStore } from "@ui/state/readModels";
import { deterministicReadModelSnapshot } from "@ui/test-utils/readModelFixtures";
import { resetIntentState } from "@ui/state/intents";
import { clearTelemetrySnapshots } from "@ui/state/telemetry";
import type { ReadModelSnapshot } from "@ui/state/readModels.types";

type DeepMutable<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? DeepMutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
      : T;

const STRUCTURE_ID = "structure-green-harbor";
const ROOM_ID = "room-veg-a";
const ZONE_ID = "zone-veg-a-1";
const SPARKLINE_POINTS = 24;

function assertSnapshot(
  snapshot: ZoneDetailSnapshot | null,
  message: string
): asserts snapshot is ZoneDetailSnapshot {
  if (!snapshot) {
    throw new Error(message);
  }
}

describe("useZoneDetailView", () => {
  let latestSnapshot: ZoneDetailSnapshot | null = null;

  function TestProbe(): null {
    latestSnapshot = useZoneDetailView(STRUCTURE_ID, ROOM_ID, ZONE_ID);
    return null;
  }

  beforeEach(() => {
    latestSnapshot = null;
    resetReadModelStore();
    resetIntentState();
    clearTelemetrySnapshots();
  });

  afterEach(() => {
    cleanup();
    latestSnapshot = null;
    resetReadModelStore();
    resetIntentState();
    clearTelemetrySnapshots();
  });

  it("produces deterministic KPI sparklines with clamped percent ranges", () => {
    const { rerender } = render(<TestProbe />);

    assertSnapshot(latestSnapshot, "Expected snapshot to be populated after initial render");
    const initialSnapshot = latestSnapshot;
    const initialSparklines = initialSnapshot.kpis.metrics.map((metric) => ({
      id: metric.id,
      sparkline: [...metric.sparkline]
    }));

    initialSnapshot.kpis.metrics.forEach((metric) => {
      expect(metric.median).toBeGreaterThanOrEqual(metric.minimum);
      expect(metric.median).toBeLessThanOrEqual(metric.maximum);
      expect(metric.minimum).toBeGreaterThanOrEqual(0);
      expect(metric.maximum).toBeLessThanOrEqual(100);
      expect(metric.sparkline).toHaveLength(SPARKLINE_POINTS);
      metric.sparkline.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(metric.minimum);
        expect(value).toBeLessThanOrEqual(metric.maximum);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });

    act(() => {
      resetReadModelStore();
    });

    rerender(<TestProbe />);

    assertSnapshot(latestSnapshot, "Expected snapshot to be populated after rerender");
    const rerenderSnapshot = latestSnapshot;

    const rerenderSparklines = rerenderSnapshot.kpis.metrics.map((metric) => ({
      id: metric.id,
      sparkline: [...metric.sparkline]
    }));

    expect(rerenderSparklines).toEqual(initialSparklines);
  });

  it("exposes lighting and climate control data with stage-derived baselines", () => {
    render(<TestProbe />);

    assertSnapshot(latestSnapshot, "Expected snapshot to be populated after render");
    expect(latestSnapshot.controls.lighting.targetPpfd).toBe(550);
    expect(latestSnapshot.controls.lighting.measuredPpfd).toBe(550);
    expect(latestSnapshot.controls.lighting.schedule).toEqual({ onHours: 18, offHours: 6, startHour: 0 });
    expect(latestSnapshot.controls.lighting.deviceTiles.length).toBeGreaterThan(0);
    expect(latestSnapshot.controls.lighting.ghostPlaceholders).toHaveLength(0);

    expect(latestSnapshot.controls.climate.temperature.target.numericValue).toBeCloseTo(24, 5);
    expect(latestSnapshot.controls.climate.ach.target.numericValue).toBeCloseTo(6, 5);
    expect(latestSnapshot.controls.climate.ach.measured.numericValue).toBeCloseTo(5.1, 2);
    expect(latestSnapshot.controls.climate.ghostPlaceholders).toHaveLength(0);
  });

  it("surfaces ghost placeholders when lighting and climate classes are missing", () => {
    const mutatedSnapshot = structuredClone(
      deterministicReadModelSnapshot
    ) as DeepMutable<ReadModelSnapshot>;
    const structure = mutatedSnapshot.structures.find((candidate) => candidate.id === STRUCTURE_ID);
    if (!structure) {
      throw new Error("Structure not found in deterministic snapshot");
    }
    const room = structure.rooms.find((candidate) => candidate.id === ROOM_ID);
    if (!room) {
      throw new Error("Room not found in deterministic snapshot");
    }
    const zone = room.zones.find((candidate) => candidate.id === ZONE_ID);
    if (!zone) {
      throw new Error("Zone not found in deterministic snapshot");
    }

    zone.devices = zone.devices.filter((device) => device.class !== "lighting");
    structure.devices = structure.devices.filter((device) => device.class !== "climate");

    applyReadModelSnapshot(mutatedSnapshot as ReadModelSnapshot);

    render(<TestProbe />);

    assertSnapshot(latestSnapshot, "Expected snapshot to be populated after applying mutated read model");
    expect(latestSnapshot.controls.lighting.deviceTiles).toHaveLength(0);
    expect(latestSnapshot.controls.lighting.ghostPlaceholders).toEqual([
      expect.objectContaining({
        deviceClassId: "lighting",
        actionLabel: CAPACITY_ADVISOR_ACTION_LABEL
      })
    ]);

    const climatePlaceholders = latestSnapshot.controls.climate.ghostPlaceholders;
    expect(climatePlaceholders).toContainEqual(
      expect.objectContaining({
        deviceClassId: "climate",
        actionLabel: CAPACITY_ADVISOR_ACTION_LABEL
      })
    );
  });
});
/* eslint-enable @typescript-eslint/no-magic-numbers */
