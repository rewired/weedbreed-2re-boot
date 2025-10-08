import type { SimulationWorld, Structure, Room, Zone, ZoneDeviceInstance } from '../../domain/world.ts';
import type { Uuid } from '../../domain/schemas/primitives.ts';
import { createDemoWorld } from '../testHarness.ts';
import { deterministicUuid } from '../../util/uuid.ts';
import { HOURS_PER_DAY } from '../../constants/simConstants.ts';
import { createDeviceInstance } from '../../device/createDeviceInstance.ts';
import {
  toDeviceInstanceEffectConfigs,
  type DeviceBlueprint
} from '../../domain/blueprints/deviceBlueprint.ts';
import { clamp01 } from '../../util/math.ts';
import devicePrices from '../../../../../../../data/prices/devicePrices.json' with { type: 'json' };
import coolAirSplitBlueprint from '../../../../../../../data/blueprints/device/climate/cool-air-split-3000.json' with { type: 'json' };
import ledVegLightBlueprint from '../../../../../../../data/blueprints/device/lighting/led-veg-light-600.json' with { type: 'json' };
import exhaustFanBlueprint from '../../../../../../../data/blueprints/device/airflow/exhaust-fan-4-inch.json' with { type: 'json' };
import carbonFilterBlueprint from '../../../../../../../data/blueprints/device/filtration/carbon-filter-6-inch.json' with { type: 'json' };

interface DeviceBlueprintEntry {
  readonly blueprint: DeviceBlueprint;
  readonly dutyCycle01: number;
}

const BASE_DEVICE_BLUEPRINTS: readonly DeviceBlueprintEntry[] = [
  { blueprint: coolAirSplitBlueprint as DeviceBlueprint, dutyCycle01: 0.8 },
  { blueprint: ledVegLightBlueprint as DeviceBlueprint, dutyCycle01: 0.75 },
  { blueprint: exhaustFanBlueprint as DeviceBlueprint, dutyCycle01: 0.9 },
  { blueprint: carbonFilterBlueprint as DeviceBlueprint, dutyCycle01: 1 }
];

interface DevicePriceEntry {
  readonly capitalExpenditure: number;
  readonly baseMaintenanceCostPerHour: number;
  readonly costIncreasePer1000Hours: number;
  readonly maintenanceServiceCost: number;
}

function resolvePriceEntry(blueprint: DeviceBlueprint): DevicePriceEntry | null {
  const entry =
    (devicePrices as { readonly devicePrices?: Record<string, DevicePriceEntry> }).devicePrices?.[
      blueprint.id
    ];

  return entry ?? null;
}

function computeSensibleCapacityW(blueprint: DeviceBlueprint): number {
  const limits = (blueprint as { readonly limits?: Record<string, unknown> }).limits as
    | { readonly maxCool_W?: number; readonly coolingCapacity_kW?: number }
    | undefined;

  if (!limits) {
    return 0;
  }

  if (typeof limits.coolingCapacity_kW === 'number' && Number.isFinite(limits.coolingCapacity_kW)) {
    return Math.max(0, limits.coolingCapacity_kW * 1_000);
  }

  if (typeof limits.maxCool_W === 'number' && Number.isFinite(limits.maxCool_W)) {
    return Math.max(0, limits.maxCool_W);
  }

  return 0;
}

function instantiateZoneDevice(
  blueprint: DeviceBlueprint,
  dutyCycle01: number,
  zoneSeed: string,
  deviceIndex: number
): ZoneDeviceInstance {
  const id = deterministicUuid('perf-target', `${zoneSeed}:${blueprint.slug}:${deviceIndex}`);
  const qualityPolicy = { sampleQuality01: () => clamp01((blueprint as { quality?: number }).quality ?? 0.85) };
  const seeded = createDeviceInstance(qualityPolicy, zoneSeed, id, blueprint);
  const { effects } = seeded;
  const { effectConfigs } = toDeviceInstanceEffectConfigs(blueprint);
  const priceEntry = resolvePriceEntry(blueprint);
  const maintenanceIntervalDays =
    (blueprint as { maintenance?: { intervalDays?: number } }).maintenance?.intervalDays ?? 90;
  const maintenanceServiceHours =
    (blueprint as { maintenance?: { hoursPerService?: number } }).maintenance?.hoursPerService ?? 1;

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
          lifetimeHours: (blueprint as { lifetime_h?: number }).lifetime_h ?? 8_760,
          maintenanceIntervalHours: maintenanceIntervalDays * HOURS_PER_DAY,
          serviceHours: maintenanceServiceHours,
          baseCostPerHourCc: priceEntry.baseMaintenanceCostPerHour,
          costIncreasePer1000HoursCc: priceEntry.costIncreasePer1000Hours,
          serviceVisitCostCc: priceEntry.maintenanceServiceCost,
          replacementCostCc: priceEntry.capitalExpenditure,
          maintenanceConditionThreshold01: 0.4,
          restoreAmount01: 0.3
        }
      }
    : undefined;

  return {
    id,
    slug: blueprint.slug,
    name: blueprint.name,
    blueprintId: blueprint.id as Uuid,
    placementScope: 'zone',
    quality01: seeded.quality01,
    condition01: 1,
    powerDraw_W: Number((blueprint as { power_W?: number }).power_W ?? 0),
    dutyCycle01: clamp01(dutyCycle01),
    efficiency01: clamp01((blueprint as { efficiency01?: number }).efficiency01 ?? 0.75),
    coverage_m2: Number((blueprint as { coverage_m2?: number }).coverage_m2 ?? 0),
    airflow_m3_per_h: Number((blueprint as { airflow_m3_per_h?: number }).airflow_m3_per_h ?? 0),
    sensibleHeatRemovalCapacity_W: computeSensibleCapacityW(blueprint),
    effects: effects ?? [],
    effectConfigs,
    maintenance
  } satisfies ZoneDeviceInstance;
}

function buildZoneDevices(zoneIndex: number): ZoneDeviceInstance[] {
  const seed = `perf-zone-${zoneIndex}`;
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
      devices: zone.devices.map((device) => ({ ...device } as ZoneDeviceInstance)),
      plants: zone.plants.map((plant) => ({ ...plant }))
    }))
  } satisfies Room;
}

function createPerfZone(baseZone: Zone, index: number): Zone {
  const zoneSeed = `perf-target-zone-${index}`;
  return {
    ...baseZone,
    id: deterministicUuid('perf-target', `${zoneSeed}:id`),
    slug: `${baseZone.slug}-perf-${index + 1}`,
    name: `${baseZone.name} Perf ${index + 1}`,
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
  const baseZone = growroom.zones[0];

  if (!baseZone) {
    return { ...structure, rooms } satisfies Structure;
  }

  const perfZones = Array.from({ length: 5 }, (_, idx) => createPerfZone(baseZone, idx));
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
