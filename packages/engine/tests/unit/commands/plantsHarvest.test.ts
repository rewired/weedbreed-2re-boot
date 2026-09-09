import { describe, expect, it } from 'vitest';

import { executePlantsHarvest } from '@/backend/src/commands/plants';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import { createTestPlant } from '@/tests/testUtils/strainFixtures.ts';
import type { Plant, Room, SimulationWorld, Zone } from '@/backend/src/domain/world';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const INTENT_ID = '00000000-0000-4000-8000-000000000501';
const OTHER_INTENT_ID = '00000000-0000-4000-8000-000000000502';

function harvestWorld(plantCount = 2): {
  world: SimulationWorld;
  command: {
    intentId: string;
    structureId: string;
    roomId: string;
    zoneId: string;
    plantIds: string[];
  };
} {
  const world = createDemoWorld();
  const structure = world.company.structures[0] as Mutable<typeof world.company.structures[0]>;
  const room = structure.rooms.find((entry) => entry.purpose === 'growroom') as Mutable<Room>;
  const zone = room.zones[0] as Mutable<Zone>;
  const base = createTestPlant();
  const plants = Array.from({ length: plantCount }, (_, index): Plant => ({
    ...base,
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}` as Plant['id'],
    name: `Ready plant ${String(index + 1)}`,
    lifecycleStage: 'harvest-ready',
    biomass_g: 400 + index * 100,
    health01: 0.8,
    moisture01: 0.55,
    quality01: 0.75,
    readyForHarvest: true,
    status: 'active',
  }));
  zone.plants = plants;
  return {
    world,
    command: {
      intentId: INTENT_ID,
      structureId: structure.id,
      roomId: room.id,
      zoneId: zone.id,
      plantIds: plants.map((plant) => plant.id),
    },
  };
}

function lots(world: SimulationWorld) {
  return world.company.structures.flatMap((structure) =>
    structure.rooms.flatMap((room) => room.inventory?.lots ?? []),
  );
}

describe('executePlantsHarvest', () => {
  it('atomically harvests multiple ready plants into deterministic lineage lots', () => {
    const { world, command } = harvestWorld();
    const result = executePlantsHarvest(world, command);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.replayed).toBe(false);
    expect(result.lots).toHaveLength(2);
    expect(result.lots.map((lot) => lot.strainId)).toEqual([
      expect.any(String), expect.any(String),
    ]);
    expect(result.lots.map((lot) => lot.source.harvestIntentId)).toEqual([
      INTENT_ID, INTENT_ID,
    ]);
    expect(result.lots.map((lot) => lot.source.plantId)).toEqual(command.plantIds);
    expect(result.lots.map((lot) => lot.freshWeight_kg)).toEqual([0.4, 0.5]);
    expect(world).not.toBe(result.world);

    const plants = result.world.company.structures[0]?.rooms
      .find((room) => room.id === command.roomId)?.zones[0]?.plants ?? [];
    expect(plants.every((plant) => plant.status === 'harvested')).toBe(true);
    expect(plants.every((plant) => plant.readyForHarvest === false)).toBe(true);
    expect(lots(result.world)).toEqual(result.lots);
    expect(result.world.breeding?.qualifiedParents).toHaveLength(2);
    expect(result.world.breeding?.qualifiedParents.map((entry) => entry.lotId)).toEqual(result.lotIds);
  });

  it('replays the same intent without another lot or world mutation', () => {
    const { world, command } = harvestWorld();
    const first = executePlantsHarvest(world, command);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const replay = executePlantsHarvest(first.world, command);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.replayed).toBe(true);
    expect(replay.world).toBe(first.world);
    expect(replay.lotIds).toEqual(first.lotIds);
    expect(lots(replay.world)).toHaveLength(2);
  });

  it('creates identical lot ids and values in independent runs', () => {
    const firstFixture = harvestWorld();
    const secondFixture = harvestWorld();
    const first = executePlantsHarvest(firstFixture.world, firstFixture.command);
    const second = executePlantsHarvest(secondFixture.world, secondFixture.command);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.lots).toEqual(second.lots);
  });

  it('rejects reuse of an intent id for another payload', () => {
    const { world, command } = harvestWorld();
    const first = executePlantsHarvest(world, { ...command, plantIds: [command.plantIds[0]!] });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const conflict = executePlantsHarvest(first.world, {
      ...command,
      plantIds: [command.plantIds[1]!],
    });
    expect(conflict).toMatchObject({ ok: false, code: 'intent_conflict', world: first.world });
  });

  it('rejects a mixed ready/not-ready batch without partial mutation', () => {
    const fixture = harvestWorld();
    const structure = fixture.world.company.structures[0] as Mutable<typeof fixture.world.company.structures[0]>;
    const room = structure.rooms.find((entry) => entry.id === fixture.command.roomId) as Mutable<Room>;
    const zone = room.zones[0] as Mutable<Zone>;
    zone.plants = zone.plants.map((plant, index) => index === 1 ? {
      ...plant,
      lifecycleStage: 'vegetative' as const,
      readyForHarvest: false,
    } : plant);

    const result = executePlantsHarvest(fixture.world, fixture.command);
    expect(result).toMatchObject({ ok: false, code: 'plant_not_ready', world: fixture.world });
    expect(lots(fixture.world)).toHaveLength(0);
    expect(zone.plants[0]?.status).toBe('active');
  });

  it.each([
    ['not found', 'storage_not_found'],
    ['ambiguous', 'storage_ambiguous'],
  ] as const)('rejects storage %s', (variant, expectedCode) => {
    const fixture = harvestWorld(1);
    const structure = fixture.world.company.structures[0] as Mutable<typeof fixture.world.company.structures[0]>;
    const storage = structure.rooms.find((room) => room.purpose === 'storageroom')!;
    structure.rooms = variant === 'not found'
      ? structure.rooms.filter((room) => room.id !== storage.id)
      : [...structure.rooms, { ...storage, id: OTHER_INTENT_ID as Room['id'] }];

    const result = executePlantsHarvest(fixture.world, fixture.command);
    expect(result).toMatchObject({ ok: false, code: expectedCode, world: fixture.world });
    expect(lots(fixture.world)).toHaveLength(0);
  });
});
