import { describe, expect, it } from 'vitest';

import { runSeedToHarvest } from '@/backend/src/engine/seedToHarvest';
import type { Plant, SimulationWorld, Zone } from '@/backend/src/domain/world';
import { WHITE_WIDOW_STRAIN_ID } from '@/tests/testUtils/strainFixtures.ts';

type SeedToHarvestResult = ReturnType<typeof runSeedToHarvest>;
type StageTransition = SeedToHarvestResult['stageTransitions'][number];

function findZone(world: SimulationWorld, zoneId: Zone['id']): Zone | null {
  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      const candidate = room.zones.find((zone) => zone.id === zoneId);

      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

describe('seed-to-harvest orchestrator integration', () => {
  it('advances White Widow plants from seed to harvest-ready and stores deterministic lots', () => {
    const result = runSeedToHarvest({
      strainId: WHITE_WIDOW_STRAIN_ID
    });

    expect(result.ticksElapsed).toBe(2256);
    expect(result.stageTransitions).toHaveLength(18);

    const transitionsByPlant = new Map<Plant['id'], StageTransition[]>();

    for (const transition of result.stageTransitions) {
      const existing = transitionsByPlant.get(transition.plantId);

      if (existing) {
        existing.push(transition);
      } else {
        transitionsByPlant.set(transition.plantId, [transition]);
      }
    }

    for (const transitions of transitionsByPlant.values()) {
      const ordered = [...transitions].sort((left, right) => left.tick - right.tick);
      const ticks = ordered.map((event) => event.tick);

      expect(ordered).toHaveLength(3);
      expect(new Set(ordered.map((event) => event.plantId)).size).toBe(1);
      expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
      expect(
        ordered.map((event) => `${event.from}->${event.to}`)
      ).toEqual(['seedling->vegetative', 'vegetative->flowering', 'flowering->harvest-ready']);
    }

    if (result.photoperiodTransitions.length === 0) {
      throw new Error('Expected a photoperiod transition for White Widow run');
    }

    const photoperiodFlip = result.photoperiodTransitions[0];
    expect(result.photoperiodTransitions).toHaveLength(1);
    expect(photoperiodFlip).toMatchObject({
      tick: 823,
      fromPhase: 'vegetative',
      toPhase: 'flowering',
      previousSchedule: { onHours: 18, offHours: 6, startHour: 0 },
      nextSchedule: { onHours: 12, offHours: 12, startHour: 0 }
    });

    const zone = findZone(result.world, photoperiodFlip.zoneId);
    if (!zone) {
      throw new Error('Expected zone referenced by photoperiod transition to exist');
    }

    expect(zone.lightSchedule).toEqual(photoperiodFlip.nextSchedule);
    expect(zone.photoperiodPhase).toBe('flowering');

    const finalPlants = zone.plants;
    expect(finalPlants).toHaveLength(transitionsByPlant.size);
    expect(finalPlants.every((plant) => plant.lifecycleStage === 'harvest-ready')).toBe(true);
    expect(finalPlants.every((plant) => plant.status === 'harvested')).toBe(true);

    const plantIds = new Set([...transitionsByPlant.keys()]);
    const lotPlantIds = new Set(result.harvestedLots.map((lot) => lot.source.plantId));
    expect(lotPlantIds).toEqual(plantIds);

    expect(result.harvestedLots).toHaveLength(finalPlants.length);
    expect(result.totalBiomass_g).toBeCloseTo(6, 5);

    for (const lot of result.harvestedLots) {
      expect(lot.freshWeight_kg).toBeCloseTo(0.001, 6);
      expect(lot.moisture01).toBe(0.5);
      expect(lot.quality01).toBe(0);
      expect(lot.createdAt_tick).toBe(2255);
    }
  });
});
