import { describe, expect, it } from 'vitest';

import { HOURS_PER_TICK } from '@/backend/src/constants/simConstants';
import { runTick } from '@/backend/src/engine/Engine';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import type { IrrigationEvent } from '@/backend/src/domain/interfaces/IIrrigationService';
import type { SimulationWorld, Uuid, Zone } from '@/backend/src/domain/world';

function uuid(value: string): Uuid {
  return value as Uuid;
}

const WORLD_SEED = 'irrigation-nutrients-seed';

function setWorldSeed(world: SimulationWorld, seed: string): void {
  (world as { seed: string }).seed = seed;
}

function setZoneBuffer(zone: Zone, buffer: Record<string, number>): void {
  (zone as unknown as { nutrientBuffer_mg: Record<string, number> }).nutrientBuffer_mg = buffer;
}

describe('Tick pipeline — irrigation and nutrients', () => {
  it('applies a single irrigation event and updates the nutrient buffer', () => {
    const world = createDemoWorld();
    setWorldSeed(world, WORLD_SEED);

    const structure = world.company.structures[0];
    const room = structure.rooms[0];
    const zone = room.zones[0];

    setZoneBuffer(zone, { N: 1000, P: 500, K: 800 });

    const event: IrrigationEvent = {
      water_L: 10,
      concentrations_mg_per_L: { N: 50, P: 25, K: 40 },
      targetZoneId: zone.id
    };

    const { world: nextWorld } = runTick(world, { irrigationEvents: [event] });
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    expect(nextZone.nutrientBuffer_mg.N).toBeCloseTo(1450, 5);
    expect(nextZone.nutrientBuffer_mg.P).toBeCloseTo(725, 5);
    expect(nextZone.nutrientBuffer_mg.K).toBeCloseTo(1160, 5);
  });

  it('aggregates multiple irrigation events targeting the same zone', () => {
    const world = createDemoWorld();
    setWorldSeed(world, WORLD_SEED);

    const zone = world.company.structures[0].rooms[0].zones[0];
    setZoneBuffer(zone, { N: 500, P: 200, K: 300, Ca: 100 });

    const events: IrrigationEvent[] = [
      {
        water_L: 10,
        concentrations_mg_per_L: { N: 50, P: 25, K: 40 },
        targetZoneId: zone.id
      },
      {
        water_L: 5,
        concentrations_mg_per_L: { N: 30, Ca: 10 },
        targetZoneId: zone.id
      }
    ];

    const { world: nextWorld } = runTick(world, { irrigationEvents: events });
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    const expectedBuffer = {
      N: 500 + 650 - 65,
      P: 200 + 250 - 25,
      K: 300 + 400 - 40,
      Ca: 100 + 50 - 5
    } as const;

    expect(nextZone.nutrientBuffer_mg.N).toBeCloseTo(expectedBuffer.N, 5);
    expect(nextZone.nutrientBuffer_mg.P).toBeCloseTo(expectedBuffer.P, 5);
    expect(nextZone.nutrientBuffer_mg.K).toBeCloseTo(expectedBuffer.K, 5);
    expect(nextZone.nutrientBuffer_mg.Ca).toBeCloseTo(expectedBuffer.Ca, 5);
  });

  it('computes leaching consistent with the nutrient buffer reference vector', () => {
    const world = createDemoWorld();
    setWorldSeed(world, WORLD_SEED);

    const zone = world.company.structures[0].rooms[0].zones[0];
    setZoneBuffer(zone, { N: 1000, P: 500, K: 800 });

    const event: IrrigationEvent = {
      water_L: 10,
      concentrations_mg_per_L: { N: 50, P: 25, K: 40 },
      targetZoneId: zone.id
    };

    const { world: nextWorld } = runTick(world, { irrigationEvents: [event] });
    const nextZone = nextWorld.company.structures[0].rooms[0].zones[0];

    const leachedN = 1000 + 500 - nextZone.nutrientBuffer_mg.N;
    const leachedP = 500 + 250 - nextZone.nutrientBuffer_mg.P;
    const leachedK = 800 + 400 - nextZone.nutrientBuffer_mg.K;

    expect(leachedN).toBeCloseTo(50, 5);
    expect(leachedP).toBeCloseTo(25, 5);
    expect(leachedK).toBeCloseTo(40, 5);
  });

  it('persists buffer state across sequential ticks', () => {
    const world = createDemoWorld();
    setWorldSeed(world, WORLD_SEED);

    const zone = world.company.structures[0].rooms[0].zones[0];
    setZoneBuffer(zone, { N: 500 });

    const firstEvent: IrrigationEvent = {
      water_L: 10,
      concentrations_mg_per_L: { N: 30 },
      targetZoneId: zone.id
    };

    const { world: afterFirst } = runTick(world, { irrigationEvents: [firstEvent] });
    const firstZone = afterFirst.company.structures[0].rooms[0].zones[0];

    expect(firstZone.nutrientBuffer_mg.N).toBeCloseTo(500 + 300 - 30, 5);

    const secondEvent: IrrigationEvent = {
      water_L: 5,
      concentrations_mg_per_L: { N: 20 },
      targetZoneId: firstZone.id
    };

    const { world: afterSecond } = runTick(afterFirst, { irrigationEvents: [secondEvent] });
    const secondZone = afterSecond.company.structures[0].rooms[0].zones[0];

    const expectedSecondBuffer = (500 + 300 - 30) + 100 - 10;
    expect(secondZone.nutrientBuffer_mg.N).toBeCloseTo(expectedSecondBuffer, 5);
  });

  it('preserves irrigation state when no events are provided while still advancing workforce telemetry', () => {
    const world = createDemoWorld();
    setWorldSeed(world, WORLD_SEED);

    const initialSimTime = world.simTimeHours;
    const initialKpiCount = world.workforce.kpis.length;
    const stageMutations: Record<string, boolean> = {};
    let lastWorld: SimulationWorld = world;

    const { world: nextWorld } = runTick(world, {
      irrigationEvents: [],
      instrumentation: {
        onStageComplete(stage, stageWorld) {
          stageMutations[stage] = stageWorld !== lastWorld;
          lastWorld = stageWorld;
        }
      }
    });

    expect(nextWorld.company).toBe(world.company);
    expect(nextWorld.simTimeHours).toBe(initialSimTime + HOURS_PER_TICK);
    expect(nextWorld.workforce.kpis).toHaveLength(initialKpiCount + 1);

    expect(stageMutations.applyWorkforce).toBe(true);
    expect(stageMutations.commitAndTelemetry).toBe(true);

    const otherStages = { ...stageMutations };
    delete otherStages.applyWorkforce;
    delete otherStages.commitAndTelemetry;

    expect(Object.values(otherStages)).not.toContain(true);
  });

  it('updates multiple zones independently based on targeted events', () => {
    const world = createDemoWorld();
    setWorldSeed(world, WORLD_SEED);

    const structure = world.company.structures[0];
    const room = structure.rooms[0];
    const zoneA = room.zones[0];

    const zoneB: Zone = {
      ...zoneA,
      id: uuid('50000000-0000-0000-0000-000000000001'),
      slug: 'zone-b',
      name: 'Zone B',
      nutrientBuffer_mg: { N: 200, P: 100 },
      moisture01: zoneA.moisture01
    } satisfies Zone;

    (room.zones as unknown as Zone[]).push(zoneB);

    const events: IrrigationEvent[] = [
      {
        water_L: 8,
        concentrations_mg_per_L: { N: 40 },
        targetZoneId: zoneA.id
      },
      {
        water_L: 4,
        concentrations_mg_per_L: { P: 30 },
        targetZoneId: zoneB.id
      }
    ];

    const { world: nextWorld } = runTick(world, { irrigationEvents: events });
    const [nextZoneA, nextZoneB] = nextWorld.company.structures[0].rooms[0].zones;

    expect(nextZoneA.nutrientBuffer_mg.N).toBeCloseTo(1000 + 320 - 32, 5);
    expect(nextZoneB.nutrientBuffer_mg.P).toBeCloseTo(100 + 120 - 12, 5);
    expect(nextZoneB.nutrientBuffer_mg.N).toBeCloseTo(200, 5);
  });
});
