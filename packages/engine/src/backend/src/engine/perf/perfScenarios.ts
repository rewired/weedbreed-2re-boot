import {
  parseDeviceBlueprint,
  parseDevicePriceMap,
  type DevicePriceEntry,
  type SimulationWorld,
  type Structure,
  type Room,
  type Zone,
  type ZoneDeviceInstance
} from '../../domain/world.ts';
import { uuidSchema } from '../../domain/schemas/primitives.ts';
import { createDemoWorld } from '../testHarness.ts';
import { deterministicUuid } from '../../util/uuid.ts';
import { fmtNum } from '../../util/format.ts';
import { HOURS_PER_DAY } from '../../constants/simConstants.ts';
import {
  PERF_HARNESS_COOL_AIR_DUTY01,
  PERF_HARNESS_CARBON_FILTER_DUTY01,
  PERF_HARNESS_DEVICE_EFFICIENCY_BASELINE01,
  PERF_HARNESS_DEVICE_LIFETIME_HOURS,
  PERF_HARNESS_DEVICE_QUALITY_BASELINE01,
  PERF_HARNESS_EXHAUST_FAN_DUTY01,
  PERF_HARNESS_LED_VEG_LIGHT_DUTY01,
  PERF_HARNESS_MAINTENANCE_INTERVAL_DAYS,
  PERF_HARNESS_MAINTENANCE_SERVICE_HOURS,
  PERF_HARNESS_MAINTENANCE_RESTORE01,
  PERF_HARNESS_MAINTENANCE_THRESHOLD01,
  PERF_HARNESS_ZONE_CLONE_COUNT
} from '../../constants/perfHarness.ts';
import { createDeviceInstance } from '../../device/createDeviceInstance.ts';
import { toDeviceInstanceEffectConfigs, type DeviceBlueprint } from '../../domain/blueprints/deviceBlueprint.ts';
import { clamp01 } from '../../util/math.ts';
import devicePriceMapJson from '../../../../../../../data/prices/devicePrices.json' with { type: 'json' };
import coolAirSplitBlueprint from '../../../../../../../data/blueprints/device/climate/cool-air-split-3000.json' with { type: 'json' };
import ledVegLightBlueprint from '../../../../../../../data/blueprints/device/lighting/led-veg-light-600.json' with { type: 'json' };
import exhaustFanBlueprint from '../../../../../../../data/blueprints/device/airflow/exhaust-fan-4-inch.json' with { type: 'json' };
import carbonFilterBlueprint from '../../../../../../../data/blueprints/device/filtration/carbon-filter-6-inch.json' with { type: 'json' };

interface DeviceBlueprintEntry {
  readonly blueprint: DeviceBlueprint;
  readonly dutyCycle01: number;
}

const BASE_DEVICE_BLUEPRINTS: readonly DeviceBlueprintEntry[] = [
  { blueprint: parseDeviceBlueprint(coolAirSplitBlueprint), dutyCycle01: PERF_HARNESS_COOL_AIR_DUTY01 },
  { blueprint: parseDeviceBlueprint(ledVegLightBlueprint), dutyCycle01: PERF_HARNESS_LED_VEG_LIGHT_DUTY01 },
  { blueprint: parseDeviceBlueprint(exhaustFanBlueprint), dutyCycle01: PERF_HARNESS_EXHAUST_FAN_DUTY01 },
  { blueprint: parseDeviceBlueprint(carbonFilterBlueprint), dutyCycle01: PERF_HARNESS_CARBON_FILTER_DUTY01 }
];

const devicePriceMap = parseDevicePriceMap(devicePriceMapJson);
const devicePriceEntries: Record<string, DevicePriceEntry> = devicePriceMap.devicePrices;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null;
}

function readFiniteNumber(record: UnknownRecord, key: string): number | undefined {
  const candidate = record[key];
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined;
}

function resolvePriceEntry(blueprint: DeviceBlueprint): DevicePriceEntry | null {
  return devicePriceEntries[blueprint.id] ?? null;
}

function computeSensibleCapacityW(blueprint: DeviceBlueprint): number {
  const blueprintRecord = blueprint as UnknownRecord;
  const limitsRecord = asRecord(blueprintRecord.limits);

  if (!limitsRecord) {
    return 0;
  }

  const coolingCapacity = readFiniteNumber(limitsRecord, 'coolingCapacity_kW');

  if (coolingCapacity !== undefined) {
    return Math.max(0, coolingCapacity * 1_000);
  }

  const maxCool = readFiniteNumber(limitsRecord, 'maxCool_W');

  return maxCool !== undefined ? Math.max(0, maxCool) : 0;
}

function instantiateZoneDevice(
  blueprint: DeviceBlueprint,
  dutyCycle01: number,
  zoneSeed: string,
  deviceIndex: number
): ZoneDeviceInstance {
  const id = deterministicUuid('perf-target', `${zoneSeed}:${blueprint.slug}:${fmtNum(deviceIndex)}`);
  const qualityPolicy = {
    sampleQuality01: () =>
      clamp01(resolveOptionalNumber(blueprint, 'quality') ?? PERF_HARNESS_DEVICE_QUALITY_BASELINE01)
  };
  const seeded = createDeviceInstance(qualityPolicy, zoneSeed, id, blueprint);
  const { effects } = seeded;
  const { effectConfigs } = toDeviceInstanceEffectConfigs(blueprint);
  const priceEntry = resolvePriceEntry(blueprint);
  const maintenanceIntervalDays =
    resolveMaintenanceNumber(blueprint, 'intervalDays') ?? PERF_HARNESS_MAINTENANCE_INTERVAL_DAYS;
  const maintenanceServiceHours =
    resolveMaintenanceNumber(blueprint, 'hoursPerService') ?? PERF_HARNESS_MAINTENANCE_SERVICE_HOURS;

  const maintenance = priceEntry
    ? {
        runtimeHours: 0,
        hoursSinceService: 0,
        totalMaintenanceCostCc: 0,
        completedServiceCount: 0,
        lastServiceScheduledTick: undefined,
        lastServiceCompletedTick: undefined,
        maintenanceWindow: undefined,
        recommendedReplacement: false,
        policy: {
          lifetimeHours:
            resolveOptionalNumber(blueprint, 'lifetime_h') ?? PERF_HARNESS_DEVICE_LIFETIME_HOURS,
          maintenanceIntervalHours: maintenanceIntervalDays * HOURS_PER_DAY,
          serviceHours: maintenanceServiceHours,
          baseCostPerHourCc: priceEntry.baseMaintenanceCostPerHour,
          costIncreasePer1000HoursCc: priceEntry.costIncreasePer1000Hours,
          serviceVisitCostCc: priceEntry.maintenanceServiceCost,
          replacementCostCc: priceEntry.capitalExpenditure,
          maintenanceConditionThreshold01: PERF_HARNESS_MAINTENANCE_THRESHOLD01,
          restoreAmount01: PERF_HARNESS_MAINTENANCE_RESTORE01
        }
      }
    : undefined;

  return {
    id,
    slug: blueprint.slug,
    name: blueprint.name,
    blueprintId: uuidSchema.parse(blueprint.id),
    placementScope: 'zone',
    quality01: seeded.quality01,
    condition01: 1,
    powerDraw_W: blueprint.power_W,
    dutyCycle01: clamp01(dutyCycle01),
    efficiency01: clamp01(
      resolveOptionalNumber(blueprint, 'efficiency01') ?? PERF_HARNESS_DEVICE_EFFICIENCY_BASELINE01
    ),
    coverage_m2: blueprint.coverage_m2 ?? 0,
    airflow_m3_per_h: blueprint.airflow_m3_per_h ?? 0,
    sensibleHeatRemovalCapacity_W: computeSensibleCapacityW(blueprint),
    effects: effects ?? [],
    effectConfigs,
    maintenance
  } satisfies ZoneDeviceInstance;
}

function resolveOptionalNumber(blueprint: DeviceBlueprint, key: string): number | undefined {
  const blueprintRecord = blueprint as UnknownRecord;
  return readFiniteNumber(blueprintRecord, key);
}

function resolveMaintenanceNumber(
  blueprint: DeviceBlueprint,
  key: 'intervalDays' | 'hoursPerService'
): number | undefined {
  const blueprintRecord = blueprint as UnknownRecord;
  const maintenanceRecord = asRecord(blueprintRecord.maintenance);

  if (!maintenanceRecord) {
    return undefined;
  }

  return readFiniteNumber(maintenanceRecord, key);
}

function buildZoneDevices(zoneIndex: number): ZoneDeviceInstance[] {
  const seed = `perf-zone-${fmtNum(zoneIndex)}`;
  return BASE_DEVICE_BLUEPRINTS.map((entry, index) =>
    instantiateZoneDevice(entry.blueprint, entry.dutyCycle01, seed, index)
  );
}

function cloneRoom(room: Room): Room {
  return {
    ...room,
    zones: room.zones.map((zone) => ({
      ...zone,
      nutrientBuffer_mg: { ...zone.nutrientBuffer_mg },
      devices: zone.devices.map((device): ZoneDeviceInstance => ({ ...device })),
      plants: zone.plants.map((plant) => ({ ...plant }))
    }))
  } satisfies Room;
}

function createPerfZone(baseZone: Zone, index: number): Zone {
  const zoneSeed = `perf-target-zone-${fmtNum(index)}`;
  return {
    ...baseZone,
    id: deterministicUuid('perf-target', `${zoneSeed}:id`),
    slug: `${baseZone.slug}-perf-${fmtNum(index + 1)}`,
    name: `${baseZone.name} Perf ${fmtNum(index + 1)}`,
    devices: buildZoneDevices(index),
    plants: baseZone.plants.map((plant) => ({ ...plant })),
    nutrientBuffer_mg: { ...baseZone.nutrientBuffer_mg }
  } satisfies Zone;
}

function createPerfStructure(structure: Structure): Structure {
  const rooms = structure.rooms.map((room) => cloneRoom(room));
  const growroomIndex = rooms.findIndex((room) => room.purpose === 'growroom');

  if (growroomIndex < 0) {
    return { ...structure, rooms } satisfies Structure;
  }

  const growroom = rooms[growroomIndex];
  if (growroom.zones.length === 0) {
    return { ...structure, rooms } satisfies Structure;
  }

  const baseZone = growroom.zones[0];

  const perfZones = Array.from({ length: PERF_HARNESS_ZONE_CLONE_COUNT }, (_, idx) =>
    createPerfZone(baseZone, idx)
  );
  const nextGrowroom: Room = {
    ...growroom,
    zones: perfZones
  } satisfies Room;

  const nextRooms = [...rooms];
  nextRooms[growroomIndex] = nextGrowroom;

  return {
    ...structure,
    rooms: nextRooms
  } satisfies Structure;
}

export function createBaselinePerfWorld(): SimulationWorld {
  return createDemoWorld();
}

export function createTargetPerfWorld(): SimulationWorld {
  const world = createDemoWorld();
  const structures = world.company.structures.map((structure) => createPerfStructure(structure));

  return {
    ...world,
    company: {
      ...world.company,
      structures
    }
  } satisfies SimulationWorld;
}
