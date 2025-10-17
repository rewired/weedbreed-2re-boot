/* eslint-disable wb-sim/no-ts-import-js-extension */

import type {
  CompatibilityMaps,
  DeviceSummary,
  EconomyReadModel,
  HrReadModel,
  PriceBookCatalog,
  ReadModelSnapshot,
  RoomReadModel,
  SimulationIncidentSummary,
  SimulationReadModel,
  StructureReadModel,
  TimelineEntry,
  ZoneReadModel,
} from '../../../ui/src/state/readModels.types.js';

export type {
  CompatibilityMaps,
  DeviceSummary,
  EconomyReadModel,
  HrReadModel,
  PriceBookCatalog,
  ReadModelSnapshot,
  RoomReadModel,
  SimulationReadModel,
  StructureReadModel,
  TimelineEntry,
  ZoneReadModel,
} from '../../../ui/src/state/readModels.types.js';

function compareByString<T>(select: (item: T) => string): (left: T, right: T) => number {
  return (left, right) => select(left).localeCompare(select(right));
}

function compareByNumber<T>(select: (item: T) => number): (left: T, right: T) => number {
  return (left, right) => {
    const leftValue = select(left);
    const rightValue = select(right);

    if (leftValue === rightValue) {
      return 0;
    }

    return leftValue < rightValue ? -1 : 1;
  };
}

function sortTimeline(entries: readonly TimelineEntry[]): TimelineEntry[] {
  return Array.from(entries).sort(compareByNumber((entry) => entry.timestamp));
}

function cloneDeviceSummary(device: DeviceSummary): DeviceSummary {
  return {
    ...device,
    warnings: Array.from(device.warnings).sort(compareByString((warning) => warning.id)),
  } satisfies DeviceSummary;
}

function normaliseZone(zone: ZoneReadModel): ZoneReadModel {
  return {
    ...zone,
    devices: Array.from(zone.devices, cloneDeviceSummary).sort(compareByString((item) => item.name)),
    coverageWarnings: Array.from(zone.coverageWarnings).sort(compareByString((warning) => warning.id)),
    timeline: sortTimeline(zone.timeline),
    tasks: Array.from(zone.tasks).sort(compareByNumber((task) => task.scheduledTick)),
  } satisfies ZoneReadModel;
}

function normaliseRoom(room: RoomReadModel): RoomReadModel {
  return {
    ...room,
    devices: Array.from(room.devices, cloneDeviceSummary).sort(compareByString((device) => device.name)),
    zones: Array.from(room.zones, normaliseZone).sort(compareByString((zone) => zone.name)),
    timeline: sortTimeline(room.timeline),
  } satisfies RoomReadModel;
}

function normaliseStructure(structure: StructureReadModel): StructureReadModel {
  return {
    ...structure,
    devices: Array.from(structure.devices, cloneDeviceSummary).sort(compareByString((device) => device.name)),
    rooms: Array.from(structure.rooms, normaliseRoom).sort(compareByString((room) => room.name)),
    timeline: sortTimeline(structure.timeline),
    workforce: {
      ...structure.workforce,
      activeAssignments: Array.from(structure.workforce.activeAssignments).sort(
        compareByString((assignment) => assignment.employeeName),
      ),
    },
  } satisfies StructureReadModel;
}

function normaliseHrReadModel(hr: HrReadModel): HrReadModel {
  return {
    directory: Array.from(hr.directory).sort(compareByString((entry) => entry.name)),
    activityTimeline: Array.from(hr.activityTimeline).sort(compareByNumber((entry) => entry.timestamp)),
    taskQueues: Array.from(hr.taskQueues, (queue) => ({
      ...queue,
      entries: Array.from(queue.entries).sort(compareByNumber((entry) => entry.dueTick)),
    })).sort(compareByString((queue) => queue.title)),
    capacitySnapshot: Array.from(hr.capacitySnapshot).sort(compareByString((entry) => entry.role)),
  } satisfies HrReadModel;
}

function normalisePriceBook(priceBook: PriceBookCatalog): PriceBookCatalog {
  return {
    seedlings: Array.from(priceBook.seedlings).sort(compareByString((entry) => entry.id)),
    containers: Array.from(priceBook.containers).sort(compareByString((entry) => entry.id)),
    substrates: Array.from(priceBook.substrates).sort(compareByString((entry) => entry.id)),
    irrigationLines: Array.from(priceBook.irrigationLines).sort(compareByString((entry) => entry.id)),
    devices: Array.from(priceBook.devices).sort(compareByString((entry) => entry.id)),
  } satisfies PriceBookCatalog;
}

function sortStatusRecord(record: Readonly<Record<string, string>>): Record<string, string> {
  const sortedEntries = Array.from(Object.entries(record)).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return Object.fromEntries(sortedEntries);
}

function normaliseCompatibilityMaps(maps: CompatibilityMaps): CompatibilityMaps {
  const cultivationEntries = Object.entries(maps.cultivationToIrrigation)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cultivationId, irrigationMap]) => [
      cultivationId,
      sortStatusRecord(irrigationMap),
    ] as const);

  const strainEntries = Object.entries(maps.strainToCultivation)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([strainId, entry]) => [
      strainId,
      {
        cultivation: sortStatusRecord(entry.cultivation),
        irrigation: sortStatusRecord(entry.irrigation),
      },
    ] as const);

  return {
    cultivationToIrrigation: Object.fromEntries(cultivationEntries),
    strainToCultivation: Object.fromEntries(strainEntries),
  } satisfies CompatibilityMaps;
}

function sortPendingIncidents(incidents: readonly SimulationIncidentSummary[]): SimulationIncidentSummary[] {
  return Array.from(incidents).sort(compareByNumber((incident) => incident.raisedAtTick));
}

export interface FacadeReadModelSnapshotInput {
  readonly simulation: SimulationReadModel;
  readonly economy: EconomyReadModel;
  readonly structures: readonly StructureReadModel[];
  readonly hr: HrReadModel;
  readonly priceBook: PriceBookCatalog;
  readonly compatibility: CompatibilityMaps;
}

export function composeReadModelSnapshot(input: FacadeReadModelSnapshotInput): ReadModelSnapshot {
  return {
    simulation: {
      ...input.simulation,
      pendingIncidents: sortPendingIncidents(input.simulation.pendingIncidents),
    },
    economy: { ...input.economy },
    structures: Array.from(input.structures, normaliseStructure).sort(
      compareByString((structure) => structure.name),
    ),
    hr: normaliseHrReadModel(input.hr),
    priceBook: normalisePriceBook(input.priceBook),
    compatibility: normaliseCompatibilityMaps(input.compatibility),
  } satisfies ReadModelSnapshot;
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null;
}

export function validateReadModelSnapshot(payload: unknown): ReadModelSnapshot {
  if (!isRecord(payload)) {
    throw new TypeError('Read-model snapshot must be an object.');
  }

  const { simulation, economy, structures, hr, priceBook, compatibility } = payload;

  if (!isRecord(simulation) || typeof simulation.simTimeHours !== 'number') {
    throw new TypeError('Read-model snapshot is missing a simulation branch.');
  }

  if (!isRecord(economy)) {
    throw new TypeError('Read-model snapshot is missing an economy branch.');
  }

  if (!Array.isArray(structures)) {
    throw new TypeError('Read-model snapshot is missing structure projections.');
  }

  if (!isRecord(hr)) {
    throw new TypeError('Read-model snapshot is missing HR projections.');
  }

  if (!isRecord(priceBook)) {
    throw new TypeError('Read-model snapshot is missing the price book.');
  }

  if (!isRecord(compatibility)) {
    throw new TypeError('Read-model snapshot is missing compatibility maps.');
  }

  return payload as ReadModelSnapshot;
}
