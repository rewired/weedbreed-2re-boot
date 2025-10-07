import { beforeEach, describe, expect, it } from 'vitest';

import { runTick, type EngineRunContext } from '@/backend/src/engine/Engine.js';
import { createDemoWorld } from '@/backend/src/engine/testHarness.js';
import { calculateCombinedStress } from '@/backend/src/physiology/stressModel.js';
import { clearStrainBlueprintCache, loadStrainBlueprint } from '@/backend/src/domain/blueprints/strainBlueprintLoader.js';
import type { PlantLifecycleStage, Zone } from '@/backend/src/domain/world.js';
import { AMBIENT_CO2_PPM } from '@/backend/src/constants/simConstants.js';
import {
  WHITE_WIDOW_STRAIN_ID,
  createTestPlant
} from '../../testUtils/strainFixtures.ts';

function zoneFromWorld(world: ReturnType<typeof createDemoWorld>): Zone {
  return world.company.structures[0].rooms[0].zones[0];
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe('plant stress integration', () => {
  beforeEach(() => {
    clearStrainBlueprintCache();
  });

  it('propagates VPD-driven stress across lifecycle phases', () => {
    let world = createDemoWorld();
    const initialZone = zoneFromWorld(world);
    initialZone.lightSchedule = { onHours: 24, offHours: 0, startHour: 0 };
    initialZone.photoperiodPhase = 'vegetative';
    initialZone.ppfd_umol_m2s = 650;
    initialZone.dli_mol_m2d_inc = 5;
    initialZone.environment = {
      airTemperatureC: 24,
      relativeHumidity_pct: 65,
      co2_ppm: AMBIENT_CO2_PPM
    } as Zone['environment'];
    initialZone.plants = [
      createTestPlant({
        strainId: WHITE_WIDOW_STRAIN_ID,
        lifecycleStage: 'seedling',
        ageHours: 300,
        biomass_g: 120,
        health01: 1
      })
    ];

    const strain = loadStrainBlueprint(WHITE_WIDOW_STRAIN_ID);
    expect(strain).not.toBeNull();
    if (!strain) {
      throw new Error('strain blueprint missing');
    }

    const ctx: EngineRunContext = { tickDurationHours: 24 };

    const comfortableStressValues: number[] = [];
    const stressedStressValues: number[] = [];
    const comfortBiomassDeltas: number[] = [];
    const stressBiomassDeltas: number[] = [];
    const healthTimeline: number[] = [];
    const stageTimeline: PlantLifecycleStage[] = [];

    function step(
      mode: 'comfort' | 'stress',
      mutator: (zone: Zone) => void
    ): void {
      const zoneBefore = zoneFromWorld(world);
      const plantBefore = zoneBefore.plants[0];
      const biomassBefore = plantBefore.biomass_g;

      mutator(zoneBefore);

      const result = runTick(world, ctx);
      world = result.world;

      const zoneAfter = zoneFromWorld(world);
      const plantAfter = zoneAfter.plants[0];
      const stress = calculateCombinedStress(
        zoneAfter.environment,
        zoneAfter.ppfd_umol_m2s,
        strain,
        plantAfter.lifecycleStage
      );

      if (mode === 'comfort') {
        comfortableStressValues.push(stress);
        comfortBiomassDeltas.push(plantAfter.biomass_g - biomassBefore);
      } else {
        stressedStressValues.push(stress);
        stressBiomassDeltas.push(plantAfter.biomass_g - biomassBefore);
      }

      healthTimeline.push(plantAfter.health01);
      stageTimeline.push(plantAfter.lifecycleStage);
    }

    const applyComfort = (zone: Zone): void => {
      zone.photoperiodPhase = 'flowering';
      zone.environment = {
        airTemperatureC: 24,
        relativeHumidity_pct: 65,
        co2_ppm: AMBIENT_CO2_PPM
      } as Zone['environment'];
      zone.ppfd_umol_m2s = 650;
      zone.dli_mol_m2d_inc = 5;
    };

    const applyStress = (zone: Zone): void => {
      zone.photoperiodPhase = 'flowering';
      zone.environment = {
        airTemperatureC: 31,
        relativeHumidity_pct: 18,
        co2_ppm: AMBIENT_CO2_PPM
      } as Zone['environment'];
      zone.ppfd_umol_m2s = 650;
      zone.dli_mol_m2d_inc = 5;
    };

    step('comfort', (zone) => {
      zone.photoperiodPhase = 'vegetative';
      applyComfort(zone);
    });

    expect(stageTimeline.at(-1)).toBe('vegetative');

    // Seed -> veg complete, shift photoperiod for flowering run-up.
    zoneFromWorld(world).photoperiodPhase = 'flowering';

    step('comfort', applyComfort);
    step('comfort', applyComfort);

    const baselineComfortCount = comfortableStressValues.length;
    const healthBeforeStress = healthTimeline.at(-1) ?? 1;

    for (let i = 0; i < 4; i += 1) {
      step('stress', applyStress);
    }

    const healthAfterStress = healthTimeline.at(-1) ?? 0;

    for (let i = 0; i < 8; i += 1) {
      step('comfort', applyComfort);
    }

    expect(stageTimeline.at(-1)).toBe('flowering');

    expect(comfortableStressValues.length).toBeGreaterThan(0);
    expect(stressedStressValues.length).toBeGreaterThan(0);

    const comfortableMax = Math.max(...comfortableStressValues);
    const stressedMin = Math.min(...stressedStressValues);
    expect(comfortableMax).toBeLessThan(0.35);
    expect(stressedMin).toBeGreaterThan(0.45);

    expect(healthAfterStress).toBeLessThan(healthBeforeStress);

    const meanComfortGrowth = average(comfortBiomassDeltas.slice(0, baselineComfortCount));
    const meanStressGrowth = average(stressBiomassDeltas);
    expect(meanStressGrowth).toBeLessThanOrEqual(meanComfortGrowth);
  });
});
