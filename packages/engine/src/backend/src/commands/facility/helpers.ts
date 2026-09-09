import type { Room, SimulationWorld, Structure, Uuid, Zone } from '../../domain/entities.ts';
import type { FacilityCommandErrorCode, FacilityCommandRejection } from './types.ts';

export function rejectFacilityCommand(
  world: SimulationWorld,
  code: FacilityCommandErrorCode,
  message: string,
): FacilityCommandRejection {
  return { ok: false, world, code, message };
}

export function findStructure(world: SimulationWorld, id: string): Structure | undefined {
  return world.company.structures.find((structure) => structure.id === id);
}

export function findRoom(structure: Structure, id: string): Room | undefined {
  return structure.rooms.find((room) => room.id === id);
}

export function findZone(room: Room, id: string): Zone | undefined {
  return room.zones.find((zone) => zone.id === id);
}

export function hasEntityId(world: SimulationWorld, id: Uuid): boolean {
  if (world.id === id || world.company.id === id) {
    return true;
  }

  return world.company.structures.some((structure) =>
    structure.id === id || structure.rooms.some((room) =>
      room.id === id || room.zones.some((zone) =>
        zone.id === id || zone.devices.some((device) => device.id === id),
      ),
    ),
  );
}
