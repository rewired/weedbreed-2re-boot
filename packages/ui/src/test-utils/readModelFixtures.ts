import type { ReadModelSnapshot } from "@ui/state/readModels.types";

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

type MutableRecord = Record<string, unknown>;

type DeepMutable<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
      : T;

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const element of value) {
      deepFreeze(element);
    }
  } else {
    const record = value as MutableRecord;
    for (const key of Object.keys(record)) {
      deepFreeze(record[key]);
    }
  }

  return Object.freeze(value);
}

import rawSnapshot from "./readModelSnapshot.fixture.json";

const baseReadModelSnapshot = rawSnapshot as ReadModelSnapshot;

export const deterministicReadModelSnapshot: ReadModelSnapshot = deepFreeze(
  structuredClone(baseReadModelSnapshot)
);

export function createAlteredReadModelSnapshot(): ReadModelSnapshot {
  const clone = structuredClone(baseReadModelSnapshot) as DeepMutable<ReadModelSnapshot>;
  clone.simulation.simTimeHours = clone.simulation.simTimeHours + 1;
  clone.simulation.tick = clone.simulation.tick + 1;
  clone.economy.balance_per_h = clone.economy.balance_per_h - Number.parseFloat("12.5");
  clone.structures[0].kpis.energyKwhPerDay = Number.parseFloat("4100");
  clone.structures[0].rooms[0].zones[0].kpis.healthPercent = Number.parseFloat("95");
  clone.hr.directory[0].fatiguePercent = Number.parseFloat("30");
  const typedClone: ReadModelSnapshot = clone;
  return deepFreeze(typedClone);
}

export function createUnsortedReadModelPayload(): ReadModelSnapshot {
  const clone = structuredClone(baseReadModelSnapshot) as DeepMutable<ReadModelSnapshot>;
  clone.structures.reverse();
  for (const structure of clone.structures) {
    structure.rooms.reverse();
    structure.devices.reverse();
    for (const room of structure.rooms) {
      room.zones.reverse();
      room.devices.reverse();
      room.timeline.reverse();
      for (const zone of room.zones) {
        zone.devices.reverse();
        zone.timeline.reverse();
        zone.tasks.reverse();
      }
    }
    structure.timeline.reverse();
    structure.workforce.activeAssignments.reverse();
  }
  clone.hr.directory.reverse();
  clone.hr.activityTimeline.reverse();
  clone.hr.taskQueues.reverse();
  for (const queue of clone.hr.taskQueues) {
    queue.entries.reverse();
  }
  clone.priceBook.seedlings.reverse();
  clone.priceBook.containers.reverse();
  clone.priceBook.substrates.reverse();
  clone.priceBook.irrigationLines.reverse();
  clone.priceBook.devices.reverse();
  const cultivationEntries = Object.entries(clone.compatibility.cultivationToIrrigation).reverse();
  clone.compatibility.cultivationToIrrigation = Object.fromEntries(cultivationEntries);
  const strainEntries = Object.entries(clone.compatibility.strainToCultivation).reverse();
  const reversedStrain: Mutable<typeof clone.compatibility.strainToCultivation> = {};
  for (const [strainId, data] of strainEntries) {
    reversedStrain[strainId] = {
      cultivation: Object.fromEntries(Object.entries(data.cultivation).reverse()),
      irrigation: Object.fromEntries(Object.entries(data.irrigation).reverse())
    };
  }
  clone.compatibility.strainToCultivation = reversedStrain;
  const typedClone: ReadModelSnapshot = clone;
  return typedClone;
}
