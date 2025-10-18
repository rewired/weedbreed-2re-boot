import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  useCompatibilityMaps,
  useEconomyReadModel,
  useHRReadModel,
  usePriceBookCatalog,
  useReadModelSnapshot,
  useReadModelStatus,
  useRoomReadModel,
  useRoomZones,
  useStructureReadModel,
  useStructureReadModels,
  useStructureRooms,
  useZoneReadModel
} from "@ui/lib/readModelHooks";
import {
  configureReadModelClient,
  refreshReadModels,
  resetReadModelStore
} from "@ui/state/readModels";
import type { ReadModelSnapshot } from "@ui/state/readModels.types";
import {
  deterministicReadModelSnapshot,
  createAlteredReadModelSnapshot
} from "@ui/test-utils/readModelFixtures";

class StaticReadModelClient {
  constructor(private readonly snapshot: ReadModelSnapshot) {}

  loadReadModels(): Promise<ReadModelSnapshot> {
    return Promise.resolve(this.snapshot);
  }
}

describe("readModel hooks", () => {
  beforeEach(() => {
    resetReadModelStore();
  });

  it("exposes the deterministic stub snapshot", () => {
    const { result } = renderHook(() => useReadModelSnapshot());
    expect(result.current).toEqual(deterministicReadModelSnapshot);
  });

  it("returns structure and nested zone snapshots", () => {
    const { result: structuresResult } = renderHook(() => useStructureReadModels());
    expect(structuresResult.current).toHaveLength(
      deterministicReadModelSnapshot.structures.length
    );
    const structure = structuresResult.current[0];
    expect(structure.rooms).toHaveLength(deterministicReadModelSnapshot.structures[0].rooms.length);

    const { result: structureResult } = renderHook(() =>
      useStructureReadModel("structure-green-harbor")
    );
    expect(structureResult.current?.kpis.energyKwhPerDay).toBe(
      deterministicReadModelSnapshot.structures[0].kpis.energyKwhPerDay
    );

    const { result: roomResult } = renderHook(() =>
      useRoomReadModel("structure-green-harbor", "room-veg-a")
    );
    expect(roomResult.current?.zones).toHaveLength(2);

    const { result: zoneResult } = renderHook(() =>
      useZoneReadModel("structure-green-harbor", "room-veg-a", "zone-veg-a-1")
    );
    expect(zoneResult.current?.kpis.healthPercent).toBe(
      deterministicReadModelSnapshot.structures[0].rooms[0].zones[0].kpis.healthPercent
    );
  });

  it("returns derived collections", () => {
    const { result: roomsResult } = renderHook(() =>
      useStructureRooms("structure-green-harbor")
    );
    expect(roomsResult.current.map((room) => room.id)).toEqual([
      "room-veg-a",
      "room-post-process"
    ]);

    const { result: zonesResult } = renderHook(() =>
      useRoomZones("structure-green-harbor", "room-veg-a")
    );
    expect(zonesResult.current.map((zone) => zone.id)).toEqual([
      "zone-veg-a-1",
      "zone-veg-a-2"
    ]);
  });

  it("exposes HR, price book, and compatibility maps", () => {
    const { result: hrResult } = renderHook(() => useHRReadModel());
    expect(hrResult.current.directory[0].name).toBe("Leonie Krause");

    const { result: priceBookResult } = renderHook(() => usePriceBookCatalog());
    expect(priceBookResult.current.seedlings).toHaveLength(2);

    const { result: compatibilityResult } = renderHook(() => useCompatibilityMaps());
    expect(
      compatibilityResult.current.cultivationToIrrigation["cm-sea-of-green"]["ir-drip-inline"]
    ).toBe("ok");
  });

  it("updates status and data after a successful refresh", async () => {
    const refreshedSnapshot = createAlteredReadModelSnapshot();
    configureReadModelClient(new StaticReadModelClient(refreshedSnapshot), {
      immediateRefresh: false
    });

    await act(async () => {
      await refreshReadModels();
    });

    const { result: statusResult } = renderHook(() => useReadModelStatus());
    expect(statusResult.current).toEqual({
      status: "ready",
      lastError: null,
      lastUpdatedSimTimeHours: refreshedSnapshot.simulation.simTimeHours,
      isRefreshing: false
    });

    const { result: economyResult } = renderHook(() => useEconomyReadModel());
    expect(economyResult.current.balance).toBe(refreshedSnapshot.economy.balance);
  });
});
