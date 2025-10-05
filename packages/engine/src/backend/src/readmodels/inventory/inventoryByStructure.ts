import type { SimulationWorld, Structure, Room } from '../../domain/world.js';

export interface StructureInventorySummary {
  readonly structureId: Structure['id'];
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

export function inventoryByStructure(world: SimulationWorld): readonly StructureInventorySummary[] {
  const summaries: StructureInventorySummary[] = [];

  for (const structure of world.company.structures) {
    let totalLots = 0;
    let totalFreshWeight = 0;
    let totalQuality = 0;
    let totalMoisture = 0;

    for (const room of structure.rooms) {
      if (!isStorageRoom(room)) {
        continue;
      }

      const lots = room.inventory?.lots ?? [];

      for (const lot of lots) {
        totalLots += 1;
        totalFreshWeight += lot.freshWeight_kg;
        totalQuality += lot.quality01;
        totalMoisture += lot.moisture01;
      }
    }

    const avgQuality = totalLots > 0 ? totalQuality / totalLots : 0;
    const avgMoisture = totalLots > 0 ? totalMoisture / totalLots : 0;

    summaries.push({
      structureId: structure.id,
      totalLots,
      totalFreshWeight_kg: totalFreshWeight,
      avgQuality01: avgQuality,
      avgMoisture01: avgMoisture
    });
  }

  return summaries;
}
