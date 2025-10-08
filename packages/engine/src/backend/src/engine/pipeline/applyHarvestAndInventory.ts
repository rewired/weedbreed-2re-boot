import { clamp01 } from '../../util/math.js';
import { deterministicUuid } from '../../util/uuid.js';
import { InventorySchema } from '../../domain/schemas/InventorySchema.js';
import { HarvestLotSchema } from '../../domain/schemas/HarvestLotSchema.js';
import { resolveStorageRoomForStructure } from '../../services/storage/resolveStorageRoom.js';
import {
  TELEMETRY_HARVEST_CREATED_V1,
  TELEMETRY_STORAGE_MISSING_OR_AMBIGUOUS_V1
} from '../../telemetry/topics.js';
import type {
  HarvestLot,
  Plant,
  Room,
  SimulationWorld,
  Structure,
  Zone,
} from '../../domain/world.js';
import type { Uuid } from '../../domain/schemas/primitives.js';
import type { EngineRunContext } from '../Engine.js';

interface HarvestComputationContext {
  readonly world: SimulationWorld;
  readonly structure: Structure;
  readonly storageResolution:
    | { ok: true; room: Room }
    | { ok: false; reason: 'not_found' | 'ambiguous'; candidates: readonly Uuid[] };
  storageTelemetryEmitted: boolean;
}

function emitStorageResolutionWarning(
  ctx: HarvestComputationContext,
  engineCtx: EngineRunContext,
  zone: Zone,
  plant: Plant
): void {
  if (ctx.storageResolution.ok) {
    return;
  }

  if (!ctx.storageTelemetryEmitted) {
    engineCtx.telemetry?.emit(TELEMETRY_STORAGE_MISSING_OR_AMBIGUOUS_V1, {
      structureId: ctx.structure.id,
      candidateRoomIds: ctx.storageResolution.candidates,
      reason: ctx.storageResolution.reason
    });
    ctx.storageTelemetryEmitted = true;
  }

  engineCtx.diagnostics?.emit({
    scope: 'zone',
    code: `storage.resolve.${ctx.storageResolution.reason}`,
    zoneId: zone.id,
    message: 'Unable to resolve a storage room for harvest.',
    metadata: {
      plantId: plant.id,
      structureId: ctx.structure.id,
      candidateRoomIds: ctx.storageResolution.candidates,
      reason: ctx.storageResolution.reason
    }
  });
}

function computeLotForPlant(
  ctx: HarvestComputationContext,
  zone: Zone,
  plant: Plant,
  worldTick: number,
  lotIndex: number
): HarvestLot | null {
  if (!ctx.storageResolution.ok) {
    return null;
  }

  const storageRoom = ctx.storageResolution.room;
  const moistureSource =
    typeof plant.moisture01 === 'number' ? plant.moisture01 : zone.moisture01;
  const qualitySource =
    typeof plant.quality01 === 'number' ? plant.quality01 : plant.health01;
  const freshWeight_kg = Math.max(0, plant.biomass_g) / 1000;
  const moisture01 = clamp01(moistureSource);
  const quality01 = clamp01(qualitySource);

  const lotCandidate = {
    id: deterministicUuid(
      ctx.world.seed,
      `harvest:${ctx.structure.id}:${storageRoom.id}:${plant.id}:${String(worldTick)}:${String(lotIndex)}`
    ),
    structureId: ctx.structure.id,
    roomId: storageRoom.id,
    source: {
      plantId: plant.id,
      zoneId: zone.id
    },
    freshWeight_kg,
    moisture01,
    quality01,
    createdAt_tick: worldTick
  } satisfies HarvestLot;

  return HarvestLotSchema.parse(lotCandidate);
}

function updatePlantAfterHarvest(plant: Plant, harvestedAtTick: number): Plant {
  return {
    ...plant,
    readyForHarvest: false,
    harvestedAt_tick: harvestedAtTick,
    status: 'harvested'
  } satisfies Plant;
}

export function applyHarvestAndInventory(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  let structuresChanged = false;
  const worldTick = Math.trunc(world.simTimeHours);

  const nextStructures = world.company.structures.map((structure) => {
    const storageResolution = resolveStorageRoomForStructure(structure.id, world);
    const computationCtx: HarvestComputationContext = {
      world,
      structure,
      storageResolution,
      storageTelemetryEmitted: false
    };
    let pendingLots: HarvestLot[] = [];
    let structureChanged = false;

    const nextRooms = structure.rooms.map((room) => {
      let roomChangedFlag = 0;

      if (room.zones.length === 0) {
        return room;
      }

      const nextZones = room.zones.map((zone) => {
        let plantsChanged = false;
        const nextPlants: Plant[] = [];

        for (const plant of zone.plants) {
          if (plant.readyForHarvest !== true || plant.status === 'harvested') {
            nextPlants.push(plant);
            continue;
          }

          if (!storageResolution.ok) {
            emitStorageResolutionWarning(computationCtx, ctx, zone, plant);
            nextPlants.push(plant);
            continue;
          }

          const lot = computeLotForPlant(
            computationCtx,
            zone,
            plant,
            worldTick,
            pendingLots.length
          );

          if (!lot) {
            nextPlants.push(plant);
            continue;
          }

          pendingLots = [...pendingLots, lot];
          ctx.telemetry?.emit(TELEMETRY_HARVEST_CREATED_V1, {
            structureId: lot.structureId,
            roomId: lot.roomId,
            plantId: plant.id,
            zoneId: zone.id,
            lotId: lot.id,
            createdAt_tick: lot.createdAt_tick,
            freshWeight_kg: lot.freshWeight_kg,
            moisture01: lot.moisture01,
            quality01: lot.quality01
          });

          const harvestedPlant = updatePlantAfterHarvest(plant, lot.createdAt_tick);
          nextPlants.push(harvestedPlant);
          plantsChanged = true;
        }

        if (!plantsChanged) {
          return zone;
        }

        roomChangedFlag = 1;
        structureChanged = true;
        return {
          ...zone,
          plants: nextPlants
        } satisfies Zone;
      });

      if (roomChangedFlag === 0) {
        return room;
      }

      return {
        ...room,
        zones: nextZones
      } satisfies Room;
    });

    let roomsSnapshot = nextRooms;

    if (storageResolution.ok && pendingLots.length > 0) {
      const storageIndex = nextRooms.findIndex((room) => room.id === storageResolution.room.id);

      if (storageIndex >= 0) {
        const storageRoom = nextRooms[storageIndex];
        const existingLots = storageRoom.inventory?.lots ?? [];
        const inventory = InventorySchema.parse({
          lots: [...existingLots, ...pendingLots]
        });
        const nextStorage = { ...storageRoom, inventory } as const;
        const roomsWithInventory = nextRooms.map((room, index) =>
          index === storageIndex ? (nextStorage as Room) : room
        );
        structureChanged = true;
        roomsSnapshot = roomsWithInventory;
      }
    }

    if (!structureChanged) {
      return structure;
    }

    return {
      ...structure,
      rooms: roomsSnapshot
    } satisfies Structure;
  });

  for (let i = 0; i < nextStructures.length; i += 1) {
    if (nextStructures[i] !== world.company.structures[i]) {
      structuresChanged = true;
      break;
    }
  }

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
