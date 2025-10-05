import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runTick, type EngineRunContext } from '@/backend/src/engine/Engine.js';
import { createDemoWorld, runStages } from '@/backend/src/engine/testHarness.js';
import type { EngineDiagnostic } from '@/backend/src/engine/Engine.js';
import type { Plant, Zone } from '@/backend/src/domain/world.js';
import * as strainLoader from '@/backend/src/domain/blueprints/strainBlueprintLoader.js';
import { clearStrainBlueprintCache } from '@/backend/src/domain/blueprints/strainBlueprintLoader.js';
import {
  AK47_STRAIN_ID,
  WHITE_WIDOW_STRAIN_ID,
  createTestPlant
} from '../../testUtils/strainFixtures.ts';

const FAKE_STRAIN_ID = '44444444-4444-4444-4444-444444444444' as Plant['strainId'];

function createPlant(overrides: Partial<Plant> = {}): Plant {
  return createTestPlant({
    name: 'Integration Plant',
    slug: 'integration-plant',
    strainId: WHITE_WIDOW_STRAIN_ID,
    ...overrides
  });
}

describe('advancePhysiology pipeline', () => {
  function zone(world: ReturnType<typeof createDemoWorld>): Zone {
    return world.company.structures[0].rooms[0].zones[0];
  }

  beforeEach(() => {
    clearStrainBlueprintCache();
    vi.restoreAllMocks();
  });

  it('advances plant age by the tick duration even without strain blueprint', () => {
    const world = createDemoWorld();
    zone(world).plants = [createPlant({ ageHours: 0, strainId: FAKE_STRAIN_ID })];
    const ctx: EngineRunContext = { tickDurationHours: 2 };

    const { world: nextWorld } = runTick(world, ctx);
    const nextPlant = zone(nextWorld).plants[0];

    expect(nextPlant.ageHours).toBeCloseTo(2, 5);
    expect(nextPlant.lifecycleStage).toBe('seedling');
  });

  it('emits diagnostics when strain blueprint is missing', () => {
    const world = createDemoWorld();
    zone(world).plants = [createPlant({ ageHours: 10, strainId: FAKE_STRAIN_ID })];
    const diagnostics: EngineDiagnostic[] = [];
    const ctx: EngineRunContext = {
      tickDurationHours: 1,
      diagnostics: {
        emit: (diagnostic) => diagnostics.push(diagnostic)
      }
    } satisfies EngineRunContext;

    void runStages(world, ctx, ['advancePhysiology']);

    const strainMissing = diagnostics.filter((d) => d.code === 'plant.strain.missing');
    expect(strainMissing).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'plant.strain.missing' })])
    );
  });

  it('processes multiple plants independently', () => {
    const world = createDemoWorld();
    zone(world).plants = [
      createPlant({ id: '33333333-3333-4333-8333-333333333331' as Plant['id'], ageHours: 5 }),
      createPlant({ id: '33333333-3333-4333-8333-333333333332' as Plant['id'], ageHours: 15 })
    ];
    const ctx: EngineRunContext = { tickDurationHours: 0.5 };

    const { world: nextWorld } = runTick(world, ctx);
    const [first, second] = zone(nextWorld).plants;

    expect(first.ageHours).toBeCloseTo(5.5, 5);
    expect(second.ageHours).toBeCloseTo(15.5, 5);
  });

  it('advances plant physiology with real strain blueprint (White Widow)', () => {
    const world = createDemoWorld();
    const targetZone = zone(world);
    targetZone.environment = { airTemperatureC: 23, relativeHumidity_pct: 55 } as Zone['environment'];
    targetZone.ppfd_umol_m2s = 500;
    targetZone.lightSchedule = { onHours: 18, offHours: 6, startHour: 0 };
    targetZone.dli_mol_m2d_inc = 1.5;
    targetZone.plants = [
      createPlant({
        strainId: WHITE_WIDOW_STRAIN_ID,
        ageHours: 0,
        biomass_g: 1,
        lifecycleStage: 'seedling'
      })
    ];

    const diagnostics: EngineDiagnostic[] = [];
    const ctx: EngineRunContext = {
      tickDurationHours: 1,
      diagnostics: {
        emit: (diagnostic) => diagnostics.push(diagnostic)
      }
    } satisfies EngineRunContext;

    let currentWorld = world;

    for (let i = 0; i < 10; i += 1) {
      const { world: nextWorld } = runTick(currentWorld, ctx);
      currentWorld = nextWorld;
    }

    const updatedPlant = zone(currentWorld).plants[0];

    expect(updatedPlant.ageHours).toBeCloseTo(10, 5);
    expect(updatedPlant.lifecycleStage).toBe('seedling');
    expect(updatedPlant.biomass_g).toBeGreaterThan(1);
    expect(updatedPlant.health01).toBeGreaterThan(0.9);
    expect(diagnostics.find((d) => d.code === 'plant.strain.missing')).toBeUndefined();
  });

  it('transitions plant from seedling to vegetative with real strain', () => {
    const world = createDemoWorld();
    const targetZone = zone(world);
    targetZone.environment = { airTemperatureC: 24, relativeHumidity_pct: 55 } as Zone['environment'];
    targetZone.ppfd_umol_m2s = 550;
    targetZone.lightSchedule = { onHours: 24, offHours: 0, startHour: 0 };
    targetZone.dli_mol_m2d_inc = 1.5;
    targetZone.plants = [
      createPlant({
        strainId: WHITE_WIDOW_STRAIN_ID,
        ageHours: 300,
        lifecycleStage: 'seedling',
        biomass_g: 50
      })
    ];

    const ctx: EngineRunContext = { tickDurationHours: 2 };
    let currentWorld = world;

    for (let i = 0; i < 15; i += 1) {
      const { world: nextWorld } = runTick(currentWorld, ctx);
      currentWorld = nextWorld;
    }

    const transitionedPlant = zone(currentWorld).plants[0];

    expect(transitionedPlant.ageHours).toBeGreaterThanOrEqual(330);
    expect(transitionedPlant.lifecycleStage).toBe('vegetative');
    expect(transitionedPlant.biomass_g).toBeGreaterThan(50);
  });

  it('handles multiple plants with different strains', () => {
    const loadSpy = vi.spyOn(strainLoader, 'loadStrainBlueprint');
    const world = createDemoWorld();
    const targetZone = zone(world);
    targetZone.environment = { airTemperatureC: 23, relativeHumidity_pct: 55 } as Zone['environment'];
    targetZone.ppfd_umol_m2s = 500;
    targetZone.dli_mol_m2d_inc = 0.5;
    targetZone.plants = [
      createPlant({ strainId: WHITE_WIDOW_STRAIN_ID, ageHours: 10 }),
      createPlant({ strainId: AK47_STRAIN_ID, ageHours: 20 })
    ];

    const ctx: EngineRunContext = { tickDurationHours: 1 };
    const { world: nextWorld } = runTick(world, ctx);
    const [first, second] = zone(nextWorld).plants;

    expect(first.ageHours).toBeGreaterThan(10);
    expect(second.ageHours).toBeGreaterThan(20);
    expect(first.biomass_g).toBeGreaterThan(0);
    expect(second.biomass_g).toBeGreaterThan(0);
    expect(loadSpy.mock.calls.length).toBeLessThanOrEqual(2);
    expect(new Set(loadSpy.mock.calls.map((call) => call[0]))).toEqual(
      new Set([WHITE_WIDOW_STRAIN_ID, AK47_STRAIN_ID])
    );
  });
});
