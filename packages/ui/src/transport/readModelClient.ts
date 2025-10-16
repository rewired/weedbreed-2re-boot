import type { ReadModelClient, ReadModelRefreshOptions } from "@ui/state/readModels";
export type { ReadModelClient } from "@ui/state/readModels";
import type {
  CompatibilityMaps,
  DeviceSummary,
  HrReadModel,
  PriceBookCatalog,
  ReadModelSnapshot,
  RoomReadModel,
  StructureReadModel,
  TimelineEntry,
  ZoneReadModel
} from "@ui/state/readModels.types";

const READ_MODEL_ENDPOINT = "/api/read-models" as const;

export interface ReadModelClientOptions {
  readonly baseUrl: string;
  readonly fetchImpl?: typeof fetch;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function ensureFetch(fetchImpl: typeof fetch | undefined): typeof fetch {
  if (fetchImpl) {
    return fetchImpl;
  }

  if (typeof globalThis.fetch !== "function") {
    throw new Error("Read-model client requires a fetch implementation.");
  }

  return globalThis.fetch.bind(globalThis);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertValidPayload(payload: unknown): asserts payload is ReadModelSnapshot {
  if (!isObject(payload)) {
    throw new TypeError("Read-model payload must be an object.");
  }

  if (!isObject(payload.simulation) || typeof payload.simulation.simTimeHours !== "number") {
    throw new TypeError("Read-model payload missing simulation snapshot.");
  }

  if (!isObject(payload.economy)) {
    throw new TypeError("Read-model payload missing economy snapshot.");
  }

  if (!Array.isArray(payload.structures)) {
    throw new TypeError("Read-model payload missing structure snapshots.");
  }

  if (!isObject(payload.hr)) {
    throw new TypeError("Read-model payload missing HR snapshot.");
  }

  if (!isObject(payload.priceBook)) {
    throw new TypeError("Read-model payload missing price book snapshot.");
  }

  if (!isObject(payload.compatibility)) {
    throw new TypeError("Read-model payload missing compatibility maps.");
  }
}

function compareByString<T>(getKey: (item: T) => string): (a: T, b: T) => number {
  return (a, b) => getKey(a).localeCompare(getKey(b));
}

function compareByNumber<T>(getKey: (item: T) => number): (a: T, b: T) => number {
  return (a, b) => {
    const left = getKey(a);
    const right = getKey(b);
    return left === right ? 0 : left < right ? -1 : 1;
  };
}

function sortTimeline(entries: readonly TimelineEntry[]): TimelineEntry[] {
  return Array.from(entries).sort(compareByNumber((entry) => entry.timestamp));
}

function cloneDeviceSummary(device: DeviceSummary): DeviceSummary {
  return {
    ...device,
    warnings: Array.from(device.warnings)
  } satisfies DeviceSummary;
}

function normaliseZone(zone: ZoneReadModel): ZoneReadModel {
  return {
    ...zone,
    devices: Array.from(zone.devices, cloneDeviceSummary).sort(compareByString((item) => item.name)),
    coverageWarnings: Array.from(zone.coverageWarnings).sort(compareByString((warning) => warning.id)),
    timeline: sortTimeline(zone.timeline),
    tasks: Array.from(zone.tasks).sort(compareByNumber((item) => item.scheduledTick))
  } satisfies ZoneReadModel;
}

function normaliseRoom(room: RoomReadModel): RoomReadModel {
  return {
    ...room,
    devices: Array.from(room.devices, cloneDeviceSummary).sort(compareByString((item) => item.name)),
    zones: Array.from(room.zones, normaliseZone).sort(compareByString((item) => item.name)),
    timeline: sortTimeline(room.timeline)
  } satisfies RoomReadModel;
}

function normaliseStructure(structure: StructureReadModel): StructureReadModel {
  return {
    ...structure,
    devices: Array.from(structure.devices, cloneDeviceSummary).sort(compareByString((item) => item.name)),
    rooms: Array.from(structure.rooms, normaliseRoom).sort(compareByString((item) => item.name)),
    timeline: sortTimeline(structure.timeline),
    workforce: {
      ...structure.workforce,
      activeAssignments: Array.from(structure.workforce.activeAssignments).sort(
        compareByString((assignment) => assignment.employeeName)
      )
    }
  } satisfies StructureReadModel;
}

function normaliseHrReadModel(hr: HrReadModel): HrReadModel {
  return {
    directory: Array.from(hr.directory).sort(compareByString((entry) => entry.name)),
    activityTimeline: Array.from(hr.activityTimeline).sort(compareByNumber((entry) => entry.timestamp)),
    taskQueues: Array.from(hr.taskQueues, (queue) => ({
      ...queue,
      entries: Array.from(queue.entries).sort(compareByNumber((entry) => entry.dueTick))
    })).sort(compareByString((queue) => queue.title)),
    capacitySnapshot: Array.from(hr.capacitySnapshot).sort(compareByString((entry) => entry.role))
  } satisfies HrReadModel;
}

function normalisePriceBook(priceBook: PriceBookCatalog): PriceBookCatalog {
  return {
    seedlings: Array.from(priceBook.seedlings).sort(compareByString((entry) => entry.id)),
    containers: Array.from(priceBook.containers).sort(compareByString((entry) => entry.id)),
    substrates: Array.from(priceBook.substrates).sort(compareByString((entry) => entry.id)),
    irrigationLines: Array.from(priceBook.irrigationLines).sort(compareByString((entry) => entry.id)),
    devices: Array.from(priceBook.devices).sort(compareByString((entry) => entry.id))
  } satisfies PriceBookCatalog;
}

function sortStatusRecord(record: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Array.from(Object.entries(record)).sort(([left], [right]) => left.localeCompare(right)));
}

function normaliseCompatibilityMaps(maps: CompatibilityMaps): CompatibilityMaps {
  const cultivationEntries = Object.entries(maps.cultivationToIrrigation)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cultivationId, irrigationMap]) => [cultivationId, sortStatusRecord(irrigationMap)] as const);

  const strainEntries = Object.entries(maps.strainToCultivation)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([strainId, entry]) => [
      strainId,
      {
        cultivation: sortStatusRecord(entry.cultivation),
        irrigation: sortStatusRecord(entry.irrigation)
      }
    ] as const);

  return {
    cultivationToIrrigation: Object.fromEntries(cultivationEntries),
    strainToCultivation: Object.fromEntries(strainEntries)
  } satisfies CompatibilityMaps;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const element of value) {
      deepFreeze(element);
    }
  } else {
    for (const key of Object.keys(value)) {
      const nested = (value as Record<string, unknown>)[key];
      deepFreeze(nested);
    }
  }

  return Object.freeze(value);
}

function normaliseReadModelSnapshot(snapshot: ReadModelSnapshot): ReadModelSnapshot {
  const sortedStructures = Array.from(snapshot.structures, normaliseStructure).sort(
    compareByString((structure) => structure.name)
  );

  return deepFreeze({
    simulation: {
      ...snapshot.simulation,
      pendingIncidents: Array.from(snapshot.simulation.pendingIncidents).sort(
        compareByNumber((incident) => incident.raisedAtTick)
      )
    },
    economy: { ...snapshot.economy },
    structures: sortedStructures,
    hr: normaliseHrReadModel(snapshot.hr),
    priceBook: normalisePriceBook(snapshot.priceBook),
    compatibility: normaliseCompatibilityMaps(snapshot.compatibility)
  });
}

async function requestReadModels(
  endpoint: string,
  fetchImpl: typeof fetch,
  options?: ReadModelRefreshOptions
): Promise<ReadModelSnapshot> {
  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options?.signal
  });

  if (!response.ok) {
    throw new Error(`Read-model request failed with status ${String(response.status)}`);
  }

  const payload: unknown = await response.json();
  assertValidPayload(payload);
  const cloned = structuredClone(payload);
  return normaliseReadModelSnapshot(cloned);
}

export function createReadModelClient(options: ReadModelClientOptions): ReadModelClient {
  if (!options.baseUrl) {
    throw new Error("Read-model client requires a baseUrl");
  }

  const trimmedBase = trimTrailingSlash(options.baseUrl);
  const fetchImpl = ensureFetch(options.fetchImpl);
  const endpoint = `${trimmedBase}${READ_MODEL_ENDPOINT}`;

  return {
    async loadReadModels(optionsOverride?: ReadModelRefreshOptions): Promise<ReadModelSnapshot> {
      return await requestReadModels(endpoint, fetchImpl, optionsOverride);
    }
  } satisfies ReadModelClient;
}
