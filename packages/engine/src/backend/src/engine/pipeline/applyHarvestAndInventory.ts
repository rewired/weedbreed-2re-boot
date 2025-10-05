import type {
  HarvestLot,
  Plant,
  Room,
  SimulationWorld,
  Structure,
  Uuid,
  Zone
} from '../../domain/world.js';
import type { EngineRunContext } from '../Engine.js';
import type { StrainBlueprint } from '../../domain/blueprints/strainBlueprint.js';
import { loadStrainBlueprint } from '../../domain/blueprints/strainBlueprintLoader.js';
import {
  calculateHarvestQuality,
  calculateHarvestYield,
  createHarvestLot
} from '../../util/harvest.js';
import { calculateCombinedStress } from '../../util/stress.js';
import { resolveTickHours } from '../resolveTickHours.js';

interface HarvestRuntime {
  readonly strainBlueprints: Map<Uuid, StrainBlueprint>;
}

interface StorageroomPath {
  readonly structureIndex: number;
  readonly roomIndex: number;
  readonly room: Room;
}

function getOrLoadStrainBlueprint(strainId: Uuid, runtime: HarvestRuntime): StrainBlueprint | null {
  const cached = runtime.strainBlueprints.get(strainId);

  if (cached) {
    return cached;
  }

  const blueprint = loadStrainBlueprint(strainId);

  if (blueprint) {
    runtime.strainBlueprints.set(strainId, blueprint);
  }

  return blueprint;
}

function findFirstStorageroom(structures: readonly Structure[]): StorageroomPath | null {
  for (let structureIndex = 0; structureIndex < structures.length; structureIndex += 1) {
    const structure = structures[structureIndex];

    for (let roomIndex = 0; roomIndex < structure.rooms.length; roomIndex += 1) {
      const room = structure.rooms[roomIndex];

      if (room.purpose === 'storageroom') {
        return { structureIndex, roomIndex, room };
      }
    }
  }

  return null;
}

export function applyHarvestAndInventory(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const tickHours = resolveTickHours(ctx);
  const runtime: HarvestRuntime = {
    strainBlueprints: new Map()
  };

  const storageroomPath = findFirstStorageroom(world.company.structures);

  const pendingHarvestLots: HarvestLot[] = [];

  let structuresChanged = false;

  const nextStructures = world.company.structures.map((structure) => {
    let roomsChanged = false;

    const nextRooms = structure.rooms.map((room) => {
      if (room.zones.length === 0) {
        return room;
      }

      let zonesChanged = false;

      const nextZones = room.zones.map((zone) => {
        let plantsChanged = false;
        const remainingPlants: Plant[] = [];

        for (const plant of zone.plants) {
          if (plant.lifecycleStage !== 'harvest-ready') {
            remainingPlants.push(plant);
            continue;
          }

          if (!storageroomPath) {
            ctx.diagnostics?.emit({
              scope: 'zone',
              code: 'harvest.storageroom.missing',
              zoneId: zone.id,
              message: 'No storageroom available for harvest storage.',
              metadata: { plantId: plant.id }
            });
            remainingPlants.push(plant);
            continue;
          }

          const strain = getOrLoadStrainBlueprint(plant.strainId, runtime);

          if (!strain) {
            ctx.diagnostics?.emit({
              scope: 'zone',
              code: 'plant.strain.missing',
              zoneId: zone.id,
              message: 'Strain blueprint not found for plant.',
              metadata: { plantId: plant.id, strainId: plant.strainId }
            });
            remainingPlants.push(plant);
            continue;
          }

          const stress01 = calculateCombinedStress(
            zone.environment,
            zone.ppfd_umol_m2s,
            strain,
            plant.lifecycleStage
          );
          const quality01 = calculateHarvestQuality(
            plant.health01,
            stress01,
            strain.generalResilience
          );
          const dryWeight_g = calculateHarvestYield(plant.biomass_g, strain, plant.lifecycleStage);
          const harvestedAtSimHours = world.simTimeHours + tickHours;
          const lot = createHarvestLot(
            plant.strainId,
            plant.slug,
            quality01,
            dryWeight_g,
            harvestedAtSimHours,
            zone.id
          );

          pendingHarvestLots.push(lot);
          plantsChanged = true;
        }

        if (!plantsChanged) {
          return zone;
        }

        zonesChanged = true;
        return {
          ...zone,
          plants: remainingPlants
        } satisfies Zone;
      });

      if (!zonesChanged) {
        return room;
      }

      roomsChanged = true;
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

  if (pendingHarvestLots.length === 0) {
    return structuresChanged
      ? {
          ...world,
          company: {
            ...world.company,
            structures: nextStructures
          }
        }
      : world;
  }

  if (!storageroomPath) {
    return world;
  }

  const { structureIndex, roomIndex } = storageroomPath;
  const targetStructure = nextStructures[structureIndex] ?? world.company.structures[structureIndex];
  const targetRooms = targetStructure.rooms.slice();
  const targetRoom = targetRooms[roomIndex] ?? storageroomPath.room;
  const existingLots = targetRoom.harvestLots ?? [];
  const updatedRoom: Room = {
    ...targetRoom,
    harvestLots: [...existingLots, ...pendingHarvestLots]
  };
  targetRooms[roomIndex] = updatedRoom;
  const updatedStructure: Structure = {
    ...targetStructure,
    rooms: targetRooms
  };
  const finalStructures = nextStructures.slice();
  finalStructures[structureIndex] = updatedStructure;

  return {
    ...world,
    company: {
      ...world.company,
      structures: finalStructures
    }
  } satisfies SimulationWorld;
}
