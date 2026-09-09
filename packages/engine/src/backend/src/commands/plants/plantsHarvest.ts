import { z } from 'zod';

import type { Plant, SimulationWorld } from '../../domain/entities.ts';
import type { HarvestLot } from '../../domain/types/HarvestLot.ts';
import { parseCompanyWorld } from '../../domain/schemas/company.ts';
import { HarvestLotSchema } from '../../domain/schemas/HarvestLotSchema.ts';
import { InventorySchema } from '../../domain/schemas/InventorySchema.ts';
import { uuidSchema } from '../../domain/schemas/primitives.ts';
import { resolveStorageRoomForStructure } from '../../services/storage/resolveStorageRoom.ts';
import { clamp01 } from '../../util/math.ts';
import { deterministicUuid } from '../../util/uuid.ts';
import type {
  PlantsHarvestErrorCode,
  PlantsHarvestRejection,
  PlantsHarvestResult,
} from './types.ts';
import { BREEDING_PARENT_MIN_QUALITY01 } from '../../breeding/startF1BreedingRun.ts';
import { breedingStateSchema, createBreedingState } from '../../breeding/schema.ts';

const plantsHarvestSchema = z.object({
  intentId: uuidSchema,
  structureId: uuidSchema,
  roomId: uuidSchema,
  zoneId: uuidSchema,
  plantIds: z.array(uuidSchema).nonempty().refine(
    (plantIds) => new Set(plantIds).size === plantIds.length,
    'plantIds must not contain duplicates.',
  ),
}).strict();

/** Input for the authoritative `plants.harvest.v1` command. */
export interface PlantsHarvestCommand {
  readonly intentId: string;
  readonly structureId: string;
  readonly roomId: string;
  readonly zoneId: string;
  readonly plantIds: readonly string[];
}

function reject(
  world: SimulationWorld,
  code: PlantsHarvestErrorCode,
  message: string,
): PlantsHarvestRejection {
  return { ok: false, world, code, message };
}

function collectLots(world: SimulationWorld): readonly HarvestLot[] {
  return world.company.structures.flatMap((structure) =>
    structure.rooms.flatMap((room) => room.inventory?.lots ?? []),
  );
}

function createLotId(world: SimulationWorld, intentId: string, plantId: string) {
  return deterministicUuid(world.seed, `plants:harvest:${intentId}:${plantId}`);
}

function isExactReplay(
  world: SimulationWorld,
  input: z.infer<typeof plantsHarvestSchema>,
  lots: readonly HarvestLot[],
): boolean {
  if (lots.length !== input.plantIds.length) return false;
  const requested = [...input.plantIds].sort();
  const harvested = lots.map((lot) => lot.source.plantId).sort();
  return requested.every((plantId, index) => plantId === harvested[index])
    && lots.every((lot) =>
      lot.id === createLotId(world, input.intentId, lot.source.plantId)
      && lot.structureId === input.structureId
      && lot.source.zoneId === input.zoneId,
    );
}

function createLot(
  world: SimulationWorld,
  structureId: HarvestLot['structureId'],
  storageRoomId: HarvestLot['roomId'],
  zoneId: HarvestLot['source']['zoneId'],
  intentId: HarvestLot['source']['harvestIntentId'],
  plant: Plant,
  zoneMoisture01: number,
): HarvestLot {
  return HarvestLotSchema.parse({
    id: createLotId(world, intentId, plant.id),
    structureId,
    roomId: storageRoomId,
    strainId: plant.strainId,
    source: { plantId: plant.id, zoneId, harvestIntentId: intentId },
    freshWeight_kg: Math.max(0, plant.biomass_g) / 1000,
    moisture01: clamp01(plant.moisture01 ?? zoneMoisture01),
    quality01: clamp01(plant.quality01 ?? plant.health01),
    createdAt_tick: Math.trunc(world.simTimeHours),
  });
}

/** Executes an atomic, immutable, deterministic `plants.harvest.v1` mutation. */
export function executePlantsHarvest(
  world: SimulationWorld,
  command: PlantsHarvestCommand,
): PlantsHarvestResult {
  const parsed = plantsHarvestSchema.safeParse(command);
  if (!parsed.success) {
    return reject(world, 'invalid_command', parsed.error.issues[0]?.message ?? 'Invalid harvest command.');
  }
  const input = parsed.data;
  const allLots = collectLots(world);
  const intentLots = allLots.filter((lot) => lot.source.harvestIntentId === input.intentId);
  if (intentLots.length > 0) {
    return isExactReplay(world, input, intentLots)
      ? { ok: true, world, lotIds: intentLots.map((lot) => lot.id), lots: intentLots, replayed: true }
      : reject(world, 'intent_conflict', 'intentId was already used for another harvest.');
  }

  const structure = world.company.structures.find((entry) => entry.id === input.structureId);
  if (!structure) return reject(world, 'structure_not_found', 'Target structure does not exist.');
  const room = structure.rooms.find((entry) => entry.id === input.roomId);
  if (!room) return reject(world, 'room_not_found', 'Target room does not exist.');
  const zone = room.zones.find((entry) => entry.id === input.zoneId);
  if (!zone) return reject(world, 'zone_not_found', 'Target zone does not exist.');
  if (room.purpose !== 'growroom') {
    return reject(world, 'invalid_placement', 'Plants may only be harvested from growroom zones.');
  }

  const storage = resolveStorageRoomForStructure(structure.id, world);
  if (!storage.ok) {
    const code = storage.reason === 'ambiguous' ? 'storage_ambiguous' : 'storage_not_found';
    const message = storage.reason === 'ambiguous'
      ? 'Harvest requires exactly one resolvable storage room.'
      : 'Harvest requires a resolvable storage room.';
    return reject(world, code, message);
  }

  const plantsById = new Map(zone.plants.map((plant) => [plant.id, plant]));
  const requestedPlants: Plant[] = [];
  for (const plantId of input.plantIds) {
    const plant = plantsById.get(plantId);
    if (!plant) return reject(world, 'plant_not_found', `Plant ${plantId} does not exist in the target zone.`);
    if (plant.status === 'harvested') {
      return reject(world, 'plant_not_active', `Plant ${plantId} is no longer active.`);
    }
    if (plant.lifecycleStage !== 'harvest-ready' || plant.readyForHarvest !== true) {
      return reject(world, 'plant_not_ready', `Plant ${plantId} is not harvest-ready.`);
    }
    if (allLots.some((lot) => lot.source.plantId === plant.id)) {
      return reject(world, 'plant_already_harvested', `Plant ${plantId} already has a harvest lot.`);
    }
    requestedPlants.push(plant);
  }

  const intentId = uuidSchema.parse(input.intentId);
  const lots = requestedPlants.map((plant) => createLot(
    world, structure.id, storage.room.id, zone.id, intentId, plant, zone.moisture01,
  ));
  const requestedIds = new Set(input.plantIds);
  const nextZone = {
    ...zone,
    plants: zone.plants.map((plant) => requestedIds.has(plant.id) ? {
      ...plant,
      readyForHarvest: false,
      harvestedAt_tick: Math.trunc(world.simTimeHours),
      status: 'harvested' as const,
    } : plant),
  };
  const nextGrowRoom = {
    ...room,
    zones: room.zones.map((entry) => entry.id === zone.id ? nextZone : entry),
  };
  const nextStorageRoom = {
    ...storage.room,
    inventory: InventorySchema.parse({
      lots: [...(storage.room.inventory?.lots ?? []), ...lots],
    }),
  };
  const nextStructure = {
    ...structure,
    rooms: structure.rooms.map((entry) => {
      if (entry.id === room.id) return nextGrowRoom;
      if (entry.id === storage.room.id) return nextStorageRoom;
      return entry;
    }),
  };
  const company = parseCompanyWorld({
    ...world.company,
    structures: world.company.structures.map((entry) =>
      entry.id === structure.id ? nextStructure : entry),
  });
  const breeding = breedingStateSchema.parse(world.breeding ?? createBreedingState());
  const evidenceLotIds = new Set(breeding.qualifiedParents.map((entry) => entry.lotId));
  const qualifiedParents = lots
    .filter((lot) => lot.freshWeight_kg > 0 && lot.quality01 >= BREEDING_PARENT_MIN_QUALITY01 && !evidenceLotIds.has(lot.id))
    .map((lot) => ({
      strainId: lot.strainId,
      lotId: lot.id,
      harvestIntentId: lot.source.harvestIntentId,
      quality01: lot.quality01,
      qualifiedAtSimTimeHours: world.simTimeHours,
    }));
  const nextBreeding = breedingStateSchema.parse({
    ...breeding,
    qualifiedParents: [...breeding.qualifiedParents, ...qualifiedParents],
  });

  return {
    ok: true,
    world: { ...world, company, breeding: nextBreeding },
    lotIds: lots.map((lot) => lot.id),
    lots,
    replayed: false,
  };
}
