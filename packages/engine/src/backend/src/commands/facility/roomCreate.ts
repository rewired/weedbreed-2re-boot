import { z } from 'zod';

import { ROOM_DEFAULT_HEIGHT_M } from '../../constants/simConstants.ts';
import { ROOM_PURPOSES, type Room, type RoomPurpose, type SimulationWorld } from '../../domain/entities.ts';
import { parseCompanyWorld } from '../../domain/schemas/company.ts';
import { finiteNumber, nonEmptyString, uuidSchema } from '../../domain/schemas/primitives.ts';
import { isValidArea } from '../../domain/validation/roomsZones.ts';
import { deterministicUuid } from '../../util/uuid.ts';
import { findStructure, hasEntityId, rejectFacilityCommand } from './helpers.ts';
import type { FacilityMutationResult } from './types.ts';

const roomCreateSchema = z.object({
  intentId: uuidSchema,
  structureId: uuidSchema,
  name: nonEmptyString,
  purpose: z.enum([...ROOM_PURPOSES]),
  floorArea_m2: finiteNumber.positive(),
  height_m: finiteNumber.positive().optional(),
}).strict();

export interface RoomCreateCommand {
  readonly intentId: string;
  readonly structureId: string;
  readonly name: string;
  readonly purpose: RoomPurpose;
  readonly floorArea_m2: number;
  readonly height_m?: number;
}

/** Executes the authoritative `room.create.v1` world mutation. */
export function executeRoomCreate(
  world: SimulationWorld,
  command: RoomCreateCommand,
): FacilityMutationResult {
  const parsed = roomCreateSchema.safeParse(command);
  if (!parsed.success) {
    return rejectFacilityCommand(world, 'invalid_command', parsed.error.issues[0]?.message ?? 'Invalid room command.');
  }

  const input = parsed.data;
  const entityId = deterministicUuid(world.seed, `facility:room:${input.intentId}:0`);
  if (hasEntityId(world, entityId)) {
    return { ok: true, world, entityId, replayed: true };
  }

  const structure = findStructure(world, input.structureId);
  if (!structure) {
    return rejectFacilityCommand(world, 'structure_not_found', 'Target structure does not exist.');
  }

  if (!isValidArea(input.floorArea_m2)) {
    return rejectFacilityCommand(world, 'invalid_command', 'Room area must align to AREA_QUANTUM_M2.');
  }

  const heightM = input.height_m ?? ROOM_DEFAULT_HEIGHT_M;
  const usedArea = structure.rooms.reduce((sum, room) => sum + room.floorArea_m2, 0);
  const usedVolume = structure.rooms.reduce((sum, room) => sum + room.floorArea_m2 * room.height_m, 0);
  const availableArea = structure.floorArea_m2 - usedArea;
  const availableVolume = structure.floorArea_m2 * structure.height_m - usedVolume;
  if (input.floorArea_m2 > availableArea || input.floorArea_m2 * heightM > availableVolume) {
    return rejectFacilityCommand(world, 'insufficient_capacity', 'Structure capacity is insufficient for the room.');
  }

  const room: Room = {
    id: entityId,
    slug: `room-${entityId.slice(0, 8)}`,
    name: input.name,
    purpose: input.purpose,
    floorArea_m2: input.floorArea_m2,
    height_m: heightM,
    zones: [],
    devices: [],
    ...(input.purpose === 'storageroom' ? { class: 'room.storage', tags: ['storage'], inventory: { lots: [] } } : {}),
  };
  const nextStructure = { ...structure, rooms: [...structure.rooms, room] };
  const company = parseCompanyWorld({
    ...world.company,
    structures: world.company.structures.map((entry) => entry.id === structure.id ? nextStructure : entry),
  });

  return { ok: true, world: { ...world, company }, entityId, replayed: false };
}
