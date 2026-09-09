import { describe, expect, it } from 'vitest';

import { runTick } from '@/backend/src/engine/Engine';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import { createTestPlant } from '@/tests/testUtils/strainFixtures.ts';
import type { Plant, Room, Zone } from '@/backend/src/domain/world';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

describe('manual harvest pipeline integration', () => {
  it('keeps a mature active plant and creates no lot on tick', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0] as Mutable<typeof world.company.structures[0]>;
    const room = structure.rooms.find((entry) => entry.purpose === 'growroom') as Mutable<Room>;
    const zone = room.zones[0] as Mutable<Zone>;
    zone.plants = [{
      ...createTestPlant(),
      lifecycleStage: 'harvest-ready',
      readyForHarvest: true,
      status: 'active',
    } satisfies Plant];

    const result = runTick(world, {}, { trace: false }).world;
    const nextPlant = result.company.structures[0]?.rooms
      .find((entry) => entry.id === room.id)?.zones[0]?.plants[0];
    const lots = result.company.structures.flatMap((entry) =>
      entry.rooms.flatMap((candidate) => candidate.inventory?.lots ?? []),
    );

    expect(nextPlant).toMatchObject({
      lifecycleStage: 'harvest-ready',
      readyForHarvest: true,
      status: 'active',
    });
    expect(lots).toHaveLength(0);
  });
});
