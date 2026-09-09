import { describe, expect, it } from "vitest";
import { readSessionSlots, SESSION_SLOTS_STORAGE_KEY, writeSessionSlot } from "../sessionSlots";
import type { SessionEnvelope } from "../sessionEnvelope.types";

const session: SessionEnvelope = {
  sessionSchemaVersion: 1,
  engineSave: { schemaVersion: 2, seed: "slot-seed", simTime: { tick: 12, hoursElapsed: 12 }, world: { company: {} } },
  worldHash: "a".repeat(64),
  playback: { status: "paused", speedMultiplier: 4 },
  journeyProgress: { milestones: [{ code: "f1-harvested", achievedAtSimTimeHours: 12, evidenceId: "plant-1" }] }
};

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    value: () => value
  };
}

describe("session slots", () => {
  it("round-trips the exact facade envelope under a named local slot", () => {
    const storage = memoryStorage();
    writeSessionSlot(storage, "Ramp Run", session);
    expect(readSessionSlots(storage)).toEqual([{ name: "Ramp Run", session }]);
    expect(JSON.parse(storage.value()!)).toEqual([{ name: "Ramp Run", session }]);
    expect(SESSION_SLOTS_STORAGE_KEY).toBe("weed-breed.session-slots.v1");
  });

  it("does not expose corrupt or unsupported local data as a loadable slot", () => {
    expect(readSessionSlots(memoryStorage("not-json"))).toEqual([]);
    expect(readSessionSlots(memoryStorage(JSON.stringify([{ name: "Old", session: { sessionSchemaVersion: 0 } }])))).toEqual([]);
  });
});
