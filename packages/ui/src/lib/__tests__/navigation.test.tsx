import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useWorkspaceNavigation, workspaceStructures } from "@ui/lib/navigation";
import { applyReadModelSnapshot, resetReadModelStore, useReadModelStore } from "@ui/state/readModels";
import { deterministicReadModelSnapshot } from "@ui/test-utils/readModelFixtures";

describe("useWorkspaceNavigation", () => {
  afterEach(() => {
    act(() => {
      resetReadModelStore();
    });
  });

  it("returns live structure hierarchy from the read-model store", () => {
    const { result } = renderHook(() => useWorkspaceNavigation());

    const snapshotStructures = deterministicReadModelSnapshot.structures;
    expect(result.current.map((structure) => structure.id)).toEqual(
      snapshotStructures.map((structure) => structure.id)
    );

    const firstStructure = result.current[0];
    const snapshotStructure = snapshotStructures[0];
    expect(firstStructure?.rooms.map((room) => room.id)).toEqual(
      snapshotStructure.rooms.map((room) => room.id)
    );
    expect(firstStructure?.zones.map((zone) => zone.id)).toEqual(
      snapshotStructure.rooms.flatMap((room) => room.zones.map((zone) => zone.id))
    );

    const clone = structuredClone(deterministicReadModelSnapshot);
    const structure = clone.structures[0]!;
    structure.name = "Updated Harbor";
    const room = structure.rooms[0]!;
    room.name = "Updated Veg Bay";
    const zone = room.zones[0]!;
    zone.name = "Updated Veg Zone";

    act(() => {
      applyReadModelSnapshot(clone);
    });

    expect(result.current[0]?.name).toBe("Updated Harbor");
    expect(result.current[0]?.rooms[0]?.name).toBe("Updated Veg Bay");
    expect(result.current[0]?.rooms[0]?.zones[0]?.name).toBe("Updated Veg Zone");
  });

  it("falls back to fixture hierarchy when the store errors without a client", () => {
    const { result } = renderHook(() => useWorkspaceNavigation());

    act(() => {
      useReadModelStore.setState((state) => ({
        ...state,
        snapshot: {
          ...state.snapshot,
          structures: []
        },
        status: "error",
        client: null
      }));
    });

    expect(result.current).toEqual(workspaceStructures);
  });
});
