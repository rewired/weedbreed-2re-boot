import { createDemoWorld } from './testHarness.ts';
import { runTick, type EngineRunContext, type EngineInstrumentation } from './Engine.ts';
import { TELEMETRY_HARVEST_CREATED_V1 } from '../telemetry/topics.ts';
import { deterministicUuid } from '../util/uuid.ts';
import { calculateAccumulatedLightHours } from '../util/photoperiod.ts';
import { HOURS_PER_DAY, HOURS_PER_TICK } from '../constants/simConstants.ts';
import type {
  HarvestLot,
  LightSchedule,
  PhotoperiodPhase,
  Plant,
  PlantLifecycleStage,
  Room,
  SimulationWorld,
  Structure,
  Zone
} from '../domain/world.ts';
import type { Uuid } from '../domain/schemas/primitives.ts';
import { loadStrainBlueprint } from '../domain/blueprints/strainBlueprintLoader.ts';
import type { StrainBlueprint } from '../domain/blueprints/strainBlueprint.ts';

const DEFAULT_STRAIN_ID = '550e8400-e29b-41d4-a716-446655440001' as Uuid;
const DEFAULT_PLANT_COUNT = 6;
const DEFAULT_VEGETATIVE_SCHEDULE: LightSchedule = { onHours: 18, offHours: 6, startHour: 0 };
const DEFAULT_FLOWERING_SCHEDULE: LightSchedule = { onHours: 12, offHours: 12, startHour: 0 };

export type SeedToHarvestTargetStage = PlantLifecycleStage | 'harvested';

export interface SeedToHarvestStopConditions {
  readonly maxTicks?: number;
  readonly targetStage?: SeedToHarvestTargetStage;
}

export interface SeedToHarvestConfig {
  readonly worldFactory?: () => SimulationWorld;
  readonly plantCount?: number;
  readonly strainId?: Uuid;
  readonly targetZoneId?: Uuid;
  readonly vegetativeSchedule?: LightSchedule;
  readonly floweringSchedule?: LightSchedule;
  readonly stopConditions?: SeedToHarvestStopConditions;
}

export interface StageTransitionEvent {
  readonly tick: number;
  readonly simTimeHours: number;
  readonly plantId: Uuid;
  readonly from: PlantLifecycleStage;
  readonly to: PlantLifecycleStage;
  readonly zoneId: Uuid;
  readonly roomId: Uuid;
  readonly structureId: Uuid;
}

export interface PhotoperiodTransitionEvent {
  readonly tick: number;
  readonly zoneId: Uuid;
  readonly fromPhase: PhotoperiodPhase;
  readonly toPhase: PhotoperiodPhase;
  readonly previousSchedule: LightSchedule;
  readonly nextSchedule: LightSchedule;
}

export interface HarvestTelemetryEvent {
  readonly tick: number;
  readonly topic: string;
  readonly payload: Record<string, unknown>;
}

export interface SeedToHarvestResult {
  readonly world: SimulationWorld;
  readonly ticksElapsed: number;
  readonly stageTransitions: readonly StageTransitionEvent[];
  readonly photoperiodTransitions: readonly PhotoperiodTransitionEvent[];
  readonly harvestTelemetry: readonly HarvestTelemetryEvent[];
  readonly totalBiomass_g: number;
  readonly harvestedLots: readonly HarvestLot[];
}

interface PlantIndexEntry {
  readonly plant: Plant;
  readonly zone: Zone;
  readonly room: Room;
  readonly structure: Structure;
}

interface TelemetryCollector {
  readonly bus: EngineRunContext['telemetry'];
  readonly events: HarvestTelemetryEvent[];
}

interface PhotoperiodTransitionResult {
  readonly world: SimulationWorld;
  readonly transition?: PhotoperiodTransitionEvent;
}

export function runSeedToHarvest(config: SeedToHarvestConfig = {}): SeedToHarvestResult {
  const plantCount = Math.max(1, Math.trunc(config.plantCount ?? DEFAULT_PLANT_COUNT));
  const worldFactory = config.worldFactory ?? createDemoWorld;
  const strainId = config.strainId ?? DEFAULT_STRAIN_ID;
  const vegetativeSchedule = config.vegetativeSchedule ?? DEFAULT_VEGETATIVE_SCHEDULE;
  const floweringSchedule = config.floweringSchedule ?? DEFAULT_FLOWERING_SCHEDULE;

  const strain = loadRequiredStrain(strainId);
  const stopConditions = config.stopConditions ?? {};
  const targetStage = stopConditions.targetStage ?? 'harvested';

  let world = worldFactory();
  const zoneId = config.targetZoneId ?? resolveFirstZoneId(world);

  if (!zoneId) {
    throw new Error('seedToHarvest orchestrator requires at least one zone in the world.');
  }

  world = seedZoneWithPlants(world, zoneId, plantCount, strainId, vegetativeSchedule);

  const stageTransitions: StageTransitionEvent[] = [];
  const photoperiodTransitions: PhotoperiodTransitionEvent[] = [];
  let ticksElapsed = 0;
  let worldBaselineForTick = world;

  const telemetryCollector = createTelemetryCollector(() => ticksElapsed);
  const instrumentation = createStageTransitionInstrumentation(
    () => worldBaselineForTick,
    () => ticksElapsed,
    stageTransitions
  );

  const ctx: EngineRunContext = {
    telemetry: telemetryCollector.bus,
    instrumentation
  } satisfies EngineRunContext;

  const maxTicks = Math.max(1, Math.trunc(stopConditions.maxTicks ?? computeDefaultMaxTicks(strain)));

  while (ticksElapsed < maxTicks) {
    worldBaselineForTick = world;

    const tickResult = runTick(world, ctx);
    let nextWorld = tickResult.world;

    const transitionResult = maybeTransitionZonePhotoperiod(
      nextWorld,
      zoneId,
      strain,
      floweringSchedule,
      ticksElapsed
    );

    if (transitionResult.transition) {
      photoperiodTransitions.push(transitionResult.transition);
    }

    nextWorld = transitionResult.world;
    ticksElapsed += 1;
    world = nextWorld;

    if (hasMetStopCondition(world, zoneId, targetStage)) {
      break;
    }
  }

  const totalBiomass_g = sumZoneBiomass(world, zoneId);
  const harvestedLots = collectHarvestLots(world);
  const harvestTelemetry = telemetryCollector.events.filter(
    (event) => event.topic === TELEMETRY_HARVEST_CREATED_V1
  );

  return {
    world,
    ticksElapsed,
    stageTransitions,
    photoperiodTransitions,
    harvestTelemetry,
    totalBiomass_g,
    harvestedLots
  } satisfies SeedToHarvestResult;
}

function loadRequiredStrain(strainId: Uuid): StrainBlueprint {
  const blueprint = loadStrainBlueprint(strainId);

  if (!blueprint) {
    throw new Error(`Strain blueprint with id "${strainId}" could not be loaded.`);
  }

  return blueprint;
}

function resolveFirstZoneId(world: SimulationWorld): Uuid | null {
  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      for (const zone of room.zones) {
        return zone.id;
      }
    }
  }

  return null;
}

function computeDefaultMaxTicks(strain: StrainBlueprint): number {
  const { seedlingDays, vegDays, flowerDays, ripeningDays } = strain.phaseDurations;
  const totalDays = seedlingDays + vegDays + flowerDays + ripeningDays;
  const bufferDays = 2;
  return (totalDays + bufferDays) * HOURS_PER_DAY;
}

function createStageTransitionInstrumentation(
  getBaselineWorld: () => SimulationWorld,
  getCurrentTick: () => number,
  sink: StageTransitionEvent[]
): EngineInstrumentation {
  return {
    onStageComplete(stage, stageWorld) {
      if (stage !== 'advancePhysiology') {
        return;
      }

      const baseline = getBaselineWorld();
      const tick = getCurrentTick();
      const simTimeHours = baseline.simTimeHours + HOURS_PER_TICK;
      const transitions = diffPlantStages(baseline, stageWorld, tick, simTimeHours);

      if (transitions.length > 0) {
        sink.push(...transitions);
      }
    }
  } satisfies EngineInstrumentation;
}

function createTelemetryCollector(currentTick: () => number): TelemetryCollector {
  const events: HarvestTelemetryEvent[] = [];

  return {
    events,
    bus: {
      emit(topic: string, payload: Record<string, unknown>) {
        events.push({ tick: currentTick(), topic, payload });
      }
    }
  } satisfies TelemetryCollector;
}

function seedZoneWithPlants(
  world: SimulationWorld,
  zoneId: Uuid,
  plantCount: number,
  strainId: Uuid,
  schedule: LightSchedule
): SimulationWorld {
  return updateZoneInWorld(world, zoneId, (zone) => {
    const plants: Plant[] = [];

    for (let index = 0; index < plantCount; index += 1) {
      const id = deterministicUuid(world.seed, `zone:${zone.id}:plant:${index}`);
      plants.push({
        id,
        name: `Seedling ${index + 1}`,
        slug: `seedling-${index + 1}`,
        strainId,
        lifecycleStage: 'seedling',
        ageHours: 0,
        health01: 1,
        biomass_g: 1,
        containerId: zone.containerId,
        substrateId: zone.substrateId,
        readyForHarvest: false,
        status: 'active'
      });
    }

    if (plants.length === 0) {
      return zone;
    }

    return {
      ...zone,
      photoperiodPhase: 'vegetative',
      lightSchedule: schedule,
      plants
    } satisfies Zone;
  });
}

function maybeTransitionZonePhotoperiod(
  world: SimulationWorld,
  zoneId: Uuid,
  strain: StrainBlueprint,
  floweringSchedule: LightSchedule,
  tick: number
): PhotoperiodTransitionResult {
  let transition: PhotoperiodTransitionEvent | undefined;

  const nextWorld = updateZoneInWorld(world, zoneId, (zone) => {
    if (zone.photoperiodPhase === 'flowering') {
      return zone;
    }

    const activePlants = zone.plants.filter((plant) => plant.status !== 'harvested');

    if (activePlants.length === 0) {
      return zone;
    }

    const threshold = strain.stageChangeThresholds.flowering.minLightHours;
    const meetsThreshold = activePlants.every((plant) => {
      const lightHours = calculateAccumulatedLightHours(plant.ageHours, zone.lightSchedule);
      return lightHours >= threshold;
    });

    if (!meetsThreshold) {
      return zone;
    }

    transition = {
      tick,
      zoneId: zone.id,
      fromPhase: zone.photoperiodPhase,
      toPhase: 'flowering',
      previousSchedule: zone.lightSchedule,
      nextSchedule: floweringSchedule
    } satisfies PhotoperiodTransitionEvent;

    return {
      ...zone,
      photoperiodPhase: 'flowering',
      lightSchedule: floweringSchedule
    } satisfies Zone;
  });

  return { world: nextWorld, transition } satisfies PhotoperiodTransitionResult;
}

function updateZoneInWorld(
  world: SimulationWorld,
  zoneId: Uuid,
  updater: (zone: Zone) => Zone
): SimulationWorld {
  let structuresChanged = false;

  const nextStructures = world.company.structures.map((structure) => {
    let roomsChanged = false;

    const nextRooms = structure.rooms.map((room) => {
      const zoneIndex = room.zones.findIndex((zone) => zone.id === zoneId);

      if (zoneIndex === -1) {
        return room;
      }

      const zone = room.zones[zoneIndex];
      const nextZone = updater(zone);

      if (nextZone === zone) {
        return room;
      }

      roomsChanged = true;
      const nextZones = room.zones.slice();
      nextZones[zoneIndex] = nextZone;

      return {
        ...room,
        zones: nextZones
      } satisfies Room;
    });

    if (!roomsChanged) {
      return structure;
    }

    structuresChanged = true;

    return {
      ...structure,
      rooms: nextRooms
    } satisfies Structure;
  });

  if (!structuresChanged) {
    return world;
  }

  return {
    ...world,
    company: {
      ...world.company,
      structures: nextStructures
    }
  } satisfies SimulationWorld;
}

function hasMetStopCondition(
  world: SimulationWorld,
  zoneId: Uuid,
  targetStage: SeedToHarvestTargetStage
): boolean {
  const zoneRef = findZone(world, zoneId);

  if (!zoneRef) {
    return true;
  }

  const { zone } = zoneRef;

  if (targetStage === 'harvested') {
    return zone.plants.length > 0 && zone.plants.every((plant) => plant.status === 'harvested');
  }

  return zone.plants.length > 0 && zone.plants.every((plant) => plant.lifecycleStage === targetStage);
}

function findZone(
  world: SimulationWorld,
  zoneId: Uuid
): { readonly zone: Zone; readonly room: Room; readonly structure: Structure } | null {
  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      for (const zone of room.zones) {
        if (zone.id === zoneId) {
          return { zone, room, structure };
        }
      }
    }
  }

  return null;
}

function sumZoneBiomass(world: SimulationWorld, zoneId: Uuid): number {
  const zoneRef = findZone(world, zoneId);

  if (!zoneRef) {
    return 0;
  }

  return zoneRef.zone.plants.reduce((total, plant) => total + plant.biomass_g, 0);
}

function collectHarvestLots(world: SimulationWorld): HarvestLot[] {
  const lots: HarvestLot[] = [];

  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      if (!room.inventory) {
        continue;
      }

      lots.push(...room.inventory.lots);
    }
  }

  return lots;
}

function diffPlantStages(
  previousWorld: SimulationWorld,
  nextWorld: SimulationWorld,
  tick: number,
  simTimeHours: number
): StageTransitionEvent[] {
  const previousIndex = indexPlants(previousWorld);
  const nextIndex = indexPlants(nextWorld);
  const transitions: StageTransitionEvent[] = [];

  for (const [plantId, nextEntry] of nextIndex) {
    const previousEntry = previousIndex.get(plantId);

    if (!previousEntry) {
      continue;
    }

    const fromStage = previousEntry.plant.lifecycleStage;
    const toStage = nextEntry.plant.lifecycleStage;

    if (fromStage === toStage) {
      continue;
    }

    transitions.push({
      tick,
      simTimeHours,
      plantId,
      from: fromStage,
      to: toStage,
      zoneId: nextEntry.zone.id,
      roomId: nextEntry.room.id,
      structureId: nextEntry.structure.id
    });
  }

  return transitions;
}

function indexPlants(world: SimulationWorld): Map<Uuid, PlantIndexEntry> {
  const index = new Map<Uuid, PlantIndexEntry>();

  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      for (const zone of room.zones) {
        for (const plant of zone.plants) {
          index.set(plant.id, { plant, zone, room, structure });
        }
      }
    }
  }

  return index;
}
