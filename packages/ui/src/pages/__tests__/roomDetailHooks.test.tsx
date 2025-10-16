/* eslint-disable @typescript-eslint/no-magic-numbers */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RoomDetailSnapshot } from "@ui/pages/roomDetailHooks";
import { useRoomDetailView } from "@ui/pages/roomDetailHooks";
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
const GROW_ROOM_ID = "room-veg-a";
const STORAGE_ROOM_ID = "room-post-process";

let latestSnapshot: RoomDetailSnapshot | null = null;

function RoomTestProbe({ structureId, roomId }: { structureId: string; roomId: string }): null {
  latestSnapshot = useRoomDetailView(structureId, roomId);
  return null;
}

function assertSnapshot(
  snapshot: RoomDetailSnapshot | null,
  message: string
): asserts snapshot is RoomDetailSnapshot {
  if (!snapshot) {
    throw new Error(message);
  }
}

describe("useRoomDetailView", () => {
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

  it("aggregates lighting and climate controls across room zones", () => {
    render(<RoomTestProbe structureId={STRUCTURE_ID} roomId={GROW_ROOM_ID} />);

    assertSnapshot(latestSnapshot, "Expected snapshot after rendering grow room probe");
    expect(latestSnapshot.controls.lighting.targetPpfd).toBe(550);
    expect(latestSnapshot.controls.lighting.deviceTiles.length).toBeGreaterThan(0);
    expect(latestSnapshot.controls.climate.deviceClasses.length).toBeGreaterThan(0);
    expect(latestSnapshot.controls.climate.ghostPlaceholders).toHaveLength(0);
  });

  it("derives fallback lighting target for rooms without zones", () => {
    render(<RoomTestProbe structureId={STRUCTURE_ID} roomId={STORAGE_ROOM_ID} />);

    assertSnapshot(latestSnapshot, "Expected snapshot after rendering storage room probe");
    expect(latestSnapshot.controls.lighting.targetPpfd).toBe(180);
    expect(latestSnapshot.controls.lighting.deviceTiles).toHaveLength(0);
    expect(latestSnapshot.controls.lighting.ghostPlaceholders.length).toBeGreaterThan(0);
  });

  it("emits ghost placeholders when required device classes are missing", () => {
    const mutatedSnapshot = structuredClone(
      deterministicReadModelSnapshot
    ) as DeepMutable<ReadModelSnapshot>;
    const structure = mutatedSnapshot.structures.find((candidate) => candidate.id === STRUCTURE_ID);
    if (!structure) {
      throw new Error("Structure not found in deterministic snapshot");
    }
    const room = structure.rooms.find((candidate) => candidate.id === GROW_ROOM_ID);
    if (!room) {
      throw new Error("Room not found in deterministic snapshot");
    }

    room.devices = room.devices.filter((device) => device.class !== "lighting");
    structure.devices = structure.devices.filter((device) => device.class !== "climate");

    applyReadModelSnapshot(mutatedSnapshot as ReadModelSnapshot);

    render(<RoomTestProbe structureId={STRUCTURE_ID} roomId={GROW_ROOM_ID} />);

    assertSnapshot(latestSnapshot, "Expected snapshot after applying mutated read model");
    expect(latestSnapshot.controls.lighting.deviceTiles).toHaveLength(0);
    expect(latestSnapshot.controls.lighting.ghostPlaceholders[0]).toMatchObject({
      deviceClassId: "lighting"
    });
    expect(latestSnapshot.controls.climate.ghostPlaceholders).toContainEqual(
      expect.objectContaining({ deviceClassId: "climate" })
    );
  });
});
/* eslint-enable @typescript-eslint/no-magic-numbers */
