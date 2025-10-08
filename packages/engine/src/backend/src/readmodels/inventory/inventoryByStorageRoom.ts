import type { SimulationWorld, Structure, Room } from '../../domain/world.ts';

export interface StorageRoomInventorySummary {
  readonly structureId: Structure['id'];
  readonly roomId: Room['id'];
  readonly totalLots: number;
  readonly totalFreshWeight_kg: number;
  readonly avgQuality01: number;
  readonly avgMoisture01: number;
}

function isStorageRoom(room: Room): boolean {
  if (room.class === 'room.storage') {
    return true;
  }

  if (room.purpose === 'storageroom') {
    return true;
  }

  return (room.tags ?? []).includes('storage');
}

export function inventoryByStorageRoom(
  world: SimulationWorld
): readonly StorageRoomInventorySummary[] {
  const summaries: StorageRoomInventorySummary[] = [];

  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      if (!isStorageRoom(room)) {
        continue;
      }

      const lots = room.inventory?.lots ?? [];
      const totalLots = lots.length;
      const totalFreshWeight = lots.reduce((acc, lot) => acc + lot.freshWeight_kg, 0);
      const totalQuality = lots.reduce((acc, lot) => acc + lot.quality01, 0);
      const totalMoisture = lots.reduce((acc, lot) => acc + lot.moisture01, 0);
      const avgQuality = totalLots > 0 ? totalQuality / totalLots : 0;
      const avgMoisture = totalLots > 0 ? totalMoisture / totalLots : 0;

      summaries.push({
        structureId: structure.id,
        roomId: room.id,
        totalLots,
        totalFreshWeight_kg: totalFreshWeight,
        avgQuality01: avgQuality,
        avgMoisture01: avgMoisture
      });
    }
  }

  return summaries;
}
