import { describe, expect, it } from 'vitest';

import { runTick } from '@/backend/src/engine/Engine.js';
import { createDemoWorld } from '@/backend/src/engine/testHarness.js';
import { createTestPlant } from '@/tests/testUtils/strainFixtures.ts';
import { inventoryByStructure } from '@/backend/src/readmodels/inventory/inventoryByStructure.js';
import { inventoryByStorageRoom } from '@/backend/src/readmodels/inventory/inventoryByStorageRoom.js';
import type { EngineRunContext } from '@/backend/src/engine/Engine.js';
import type { Plant, Room, Zone } from '@/backend/src/domain/world.js';
import { TELEMETRY_STORAGE_MISSING_OR_AMBIGUOUS_V1 } from '@/backend/src/telemetry/topics.js';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type DemoStructure = ReturnType<typeof createDemoWorld>['company']['structures'][0];

function prepareHarvestScenario(mutateStructure?: (structure: Mutable<DemoStructure>) => void) {
  const world = createDemoWorld();
  const structure = world.company.structures[0] as Mutable<DemoStructure>;
  mutateStructure?.(structure);
  const growRoom = structure.rooms.find((room) => room.purpose === 'growroom') as Mutable<Room>;
  const zone = growRoom.zones[0] as Mutable<Zone>;
  const basePlant = zone.plants[0] ?? createTestPlant();

  zone.plants = [
    {
      ...basePlant,
      id: '00000000-0000-4000-8000-000000000001' as Plant['id'],
      lifecycleStage: 'harvest-ready',
      biomass_g: 480,
      health01: 0.88,
      moisture01: 0.6,
      quality01: 0.85,
      readyForHarvest: true,
      status: 'active'
    }
  ];

  return world;
}

describe('applyHarvestAndInventory integration', () => {
  it('aggregates inventory totals after a harvest tick', () => {
    const world = prepareHarvestScenario();
    const ctx: EngineRunContext = {};
    const { world: nextWorld } = runTick(world, ctx, { trace: false });

    const structureSummary = inventoryByStructure(nextWorld)[0];
    const storageSummary = inventoryByStorageRoom(nextWorld)[0];
    const storageRoom = nextWorld.company.structures[0].rooms.find((room) => room.inventory);
    const lots = storageRoom?.inventory?.lots ?? [];

    const totalFreshWeight = lots.reduce((acc, lot) => acc + lot.freshWeight_kg, 0);
    const totalQuality = lots.reduce((acc, lot) => acc + lot.quality01, 0);
    const totalMoisture = lots.reduce((acc, lot) => acc + lot.moisture01, 0);

    expect(lots).toHaveLength(1);
    expect(structureSummary).toMatchObject({
      totalLots: lots.length,
      totalFreshWeight_kg: totalFreshWeight,
      avgQuality01: totalQuality / lots.length,
      avgMoisture01: totalMoisture / lots.length
    });
    expect(storageSummary).toMatchObject({
      totalLots: lots.length,
      totalFreshWeight_kg: totalFreshWeight,
      avgQuality01: totalQuality / lots.length,
      avgMoisture01: totalMoisture / lots.length
    });

    const sanitizedLots = lots.map((lot) => ({
      ...lot,
      id: '<lot-id>'
    }));

    expect({
      lots: sanitizedLots,
      structureSummary,
      storageSummary
    }).toMatchInlineSnapshot(`
{
  "lots": [
    {
      "createdAt_tick": 0,
      "freshWeight_kg": 0.48,
      "id": "<lot-id>",
      "moisture01": 0.6,
      "quality01": 0.85,
      "roomId": "00000000-0000-4000-8000-000000000009",
      "source": {
        "plantId": "00000000-0000-4000-8000-000000000001",
        "zoneId": "00000000-0000-4000-8000-000000000004",
      },
      "structureId": "00000000-0000-4000-8000-000000000002",
    },
  ],
  "storageSummary": {
    "avgMoisture01": 0.6,
    "avgQuality01": 0.85,
    "roomId": "00000000-0000-4000-8000-000000000009",
    "structureId": "00000000-0000-4000-8000-000000000002",
    "totalFreshWeight_kg": 0.48,
    "totalLots": 1,
  },
  "structureSummary": {
    "avgMoisture01": 0.6,
    "avgQuality01": 0.85,
    "structureId": "00000000-0000-4000-8000-000000000002",
    "totalFreshWeight_kg": 0.48,
    "totalLots": 1,
  },
}`);
  });

  it('emits telemetry when no storage room can be resolved', () => {
    const world = prepareHarvestScenario((structure) => {
      structure.rooms = structure.rooms.filter((room) => room.purpose !== 'storageroom');
    });
    const telemetryEvents: { topic: string; payload: Record<string, unknown> }[] = [];
    const ctx: EngineRunContext = {
      telemetry: {
        emit(topic, payload) {
          telemetryEvents.push({ topic, payload });
        }
      }
    };

    const { world: nextWorld } = runTick(world, ctx, { trace: false });
    const emitted = telemetryEvents.filter((event) => event.topic === TELEMETRY_STORAGE_MISSING_OR_AMBIGUOUS_V1);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.payload).toMatchObject({ reason: 'not_found', candidateRoomIds: [] });

    const growRoom = nextWorld.company.structures[0]?.rooms.find((room) => room.purpose === 'growroom');
    const zone = growRoom?.zones[0];
    const plant = zone?.plants[0];

    expect(plant?.status).toBe('active');
    expect(plant?.readyForHarvest).toBe(true);

    const lots = nextWorld.company.structures.flatMap((structure) =>
      structure.rooms.flatMap((room) => room.inventory?.lots ?? [])
    );
    expect(lots).toHaveLength(0);
  });

  it('emits telemetry when storage resolution is ambiguous', () => {
    const world = prepareHarvestScenario((structure) => {
      const storageRoom = structure.rooms.find((room) => room.purpose === 'storageroom');

      if (storageRoom) {
        const clone: Room = { ...storageRoom, id: `${storageRoom.id}-clone` as Room['id'] };
        structure.rooms = [...structure.rooms, clone];
      }
    });
    const telemetryEvents: { topic: string; payload: Record<string, unknown> }[] = [];
    const ctx: EngineRunContext = {
      telemetry: {
        emit(topic, payload) {
          telemetryEvents.push({ topic, payload });
        }
      }
    };

    const { world: nextWorld } = runTick(world, ctx, { trace: false });
    const emitted = telemetryEvents.filter((event) => event.topic === TELEMETRY_STORAGE_MISSING_OR_AMBIGUOUS_V1);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.payload).toMatchObject({ reason: 'ambiguous' });
    expect((emitted[0]?.payload as { candidateRoomIds: string[] }).candidateRoomIds).toHaveLength(2);

    const growRoom = nextWorld.company.structures[0]?.rooms.find((room) => room.purpose === 'growroom');
    const zone = growRoom?.zones[0];
    const plant = zone?.plants[0];

    expect(plant?.status).toBe('active');
    expect(plant?.readyForHarvest).toBe(true);

    const lots = nextWorld.company.structures.flatMap((structure) =>
      structure.rooms.flatMap((room) => room.inventory?.lots ?? [])
    );
    expect(lots).toHaveLength(0);
  });
});
