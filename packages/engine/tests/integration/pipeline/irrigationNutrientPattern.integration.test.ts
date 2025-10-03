import { describe, expect, it } from 'vitest';

import { runTick, type EngineRunContext } from '@/backend/src/engine/Engine.js';
import { getIrrigationNutrientsRuntime } from '@/backend/src/engine/pipeline/applyIrrigationAndNutrients.js';
import { createDemoWorld } from '@/backend/src/engine/testHarness.js';
import type { IrrigationEvent } from '@/backend/src/domain/interfaces/IIrrigationService.js';

type NutrientSnapshot = {
  readonly uptake: Record<string, number>;
  readonly leached: Record<string, number>;
  readonly buffer: Record<string, number>;
};

describe('Tick pipeline — irrigation + nutrient buffer pattern', () => {
  it('Pattern E: Irrigation service + nutrient buffer', () => {
    const world = createDemoWorld();
    const zone = world.company.structures[0].rooms[0].zones[0];

    const startingBuffer = { N: 1000, P: 250 } satisfies Record<string, number>;
    (zone as unknown as { nutrientBuffer_mg: Record<string, number> }).nutrientBuffer_mg = {
      ...startingBuffer,
    };

    const irrigationEvent: IrrigationEvent = {
      targetZoneId: zone.id,
      water_L: 10,
      concentrations_mg_per_L: { N: 50, P: 20 },
    } satisfies IrrigationEvent;

    const snapshots: NutrientSnapshot[] = [];
    const ctx: EngineRunContext = {
      irrigationEvents: [irrigationEvent],
      instrumentation: {
        onStageComplete(stage) {
          if (stage !== 'applyIrrigationAndNutrients') {
            return;
          }

          const runtime = getIrrigationNutrientsRuntime(ctx);
          if (!runtime) {
            return;
          }

          snapshots.push({
            uptake: runtime.zoneNutrientsUptake_mg.get(zone.id) ?? {},
            leached: runtime.zoneNutrientsLeached_mg.get(zone.id) ?? {},
            buffer: runtime.zoneBufferUpdates_mg.get(zone.id) ?? {},
          });
        },
      },
    } satisfies EngineRunContext;

    const { world: nextWorld } = runTick(world, ctx);
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    const expectedDeliveredN = irrigationEvent.water_L * irrigationEvent.concentrations_mg_per_L.N;
    const expectedDeliveredP = irrigationEvent.water_L * irrigationEvent.concentrations_mg_per_L.P;
    const expectedLeachedN = expectedDeliveredN * 0.1;
    const expectedLeachedP = expectedDeliveredP * 0.1;
    const expectedBufferN = startingBuffer.N + expectedDeliveredN - expectedLeachedN;
    const expectedBufferP = startingBuffer.P + expectedDeliveredP - expectedLeachedP;

    expect(snapshots).toHaveLength(1);

    const { uptake, leached, buffer } = snapshots[0] as NutrientSnapshot;

    expect(leached.N).toBeCloseTo(expectedLeachedN, 5);
    expect(leached.P).toBeCloseTo(expectedLeachedP, 5);
    expect(Object.keys(uptake).length).toBe(0);
    expect(buffer.N).toBeCloseTo(expectedBufferN, 5);
    expect(buffer.P).toBeCloseTo(expectedBufferP, 5);

    expect(nextZone.nutrientBuffer_mg.N).toBeCloseTo(expectedBufferN, 5);
    expect(nextZone.nutrientBuffer_mg.P).toBeCloseTo(expectedBufferP, 5);
  });
});
