import { describe, expect, it } from 'vitest';

import { runTick, type EngineRunContext } from '@/backend/src/engine/Engine.js';
import { createDemoWorld, runStages } from '@/backend/src/engine/testHarness.js';
import type { EngineDiagnostic } from '@/backend/src/engine/Engine.js';
import type { Plant, Zone } from '@/backend/src/domain/world.js';

function createPlant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: '33333333-3333-4333-8333-333333333333' as Plant['id'],
    name: 'Integration Plant',
    slug: 'integration-plant',
    strainId: '44444444-4444-4444-4444-444444444444' as Plant['strainId'],
    lifecycleStage: 'seedling',
    ageHours: 0,
    health01: 1,
    biomass_g: 1,
    containerId: '55555555-5555-5555-5555-555555555555' as Plant['containerId'],
    substrateId: '66666666-6666-6666-6666-666666666666' as Plant['substrateId'],
    ...overrides
  } satisfies Plant;
}

describe('advancePhysiology pipeline', () => {
  function zone(world: ReturnType<typeof createDemoWorld>): Zone {
    return world.company.structures[0].rooms[0].zones[0];
  }

  it('advances plant age by the tick duration even without strain blueprint', () => {
    const world = createDemoWorld();
    zone(world).plants = [createPlant({ ageHours: 0 })];
    const ctx: EngineRunContext = { tickDurationHours: 2 };

    const { world: nextWorld } = runTick(world, ctx);
    const nextPlant = zone(nextWorld).plants[0];

    expect(nextPlant.ageHours).toBeCloseTo(2, 5);
    expect(nextPlant.lifecycleStage).toBe('seedling');
  });

  it('emits diagnostics when strain blueprint is missing', () => {
    const world = createDemoWorld();
    zone(world).plants = [createPlant({ ageHours: 10 })];
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
});
