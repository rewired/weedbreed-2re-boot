import type { SimulationWorld, Room, Structure } from '../../domain/world.js';
import type { Uuid } from '../../domain/schemas/primitives.js';

type ResolutionFailureReason = 'not_found' | 'ambiguous';

interface StorageResolutionSuccess {
  readonly ok: true;
  readonly room: Room;
}

interface StorageResolutionFailure {
  readonly ok: false;
  readonly reason: ResolutionFailureReason;
  readonly candidates: readonly Uuid[];
}

export type StorageResolutionResult = StorageResolutionSuccess | StorageResolutionFailure;

function findStructure(structureId: Uuid, world: SimulationWorld): Structure | undefined {
  return world.company.structures.find((structure) => structure.id === structureId);
}

function selectByClass(structure: Structure): Room[] {
  return structure.rooms.filter((room) => room.class === 'room.storage');
}

function selectByTag(structure: Structure): Room[] {
  return structure.rooms.filter((room) => (room.tags ?? []).includes('storage'));
}

function toFailure(reason: ResolutionFailureReason, rooms: readonly Room[] = []): StorageResolutionFailure {
  return {
    ok: false,
    reason,
    candidates: rooms.map((room) => room.id)
  };
}

export function resolveStorageRoomForStructure(
  structureId: Uuid,
  world: SimulationWorld
): StorageResolutionResult {
  const structure = findStructure(structureId, world);

  if (!structure) {
    return toFailure('not_found');
  }

  const classCandidates = selectByClass(structure);

  if (classCandidates.length === 1) {
    return { ok: true, room: classCandidates[0] } satisfies StorageResolutionSuccess;
  }

  if (classCandidates.length > 1) {
    return toFailure('ambiguous', classCandidates);
  }

  const tagCandidates = selectByTag(structure);

  if (tagCandidates.length === 1) {
    return { ok: true, room: tagCandidates[0] } satisfies StorageResolutionSuccess;
  }

  if (tagCandidates.length > 1) {
    return toFailure('ambiguous', tagCandidates);
  }

  return toFailure('not_found');
}
