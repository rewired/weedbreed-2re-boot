import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ZoneDetailSnapshot } from "@ui/pages/zoneDetailHooks";
import { useZoneDetailView } from "@ui/pages/zoneDetailHooks";
import { resetReadModelStore } from "@ui/state/readModels";

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
  });

  afterEach(() => {
    cleanup();
    latestSnapshot = null;
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
});
