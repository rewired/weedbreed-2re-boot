/* eslint-disable wb-sim/no-ts-import-js-extension */
import { describe, expect, it, vi } from 'vitest';

import {
  createDemoScenario,
  createEngineBootstrapConfig,
  type Plant,
  type SimulationWorld,
} from '@wb/engine';
import { createReadModelProviders } from '../../../src/server/readModelProviders.js';
import { createEngineCommandPipeline } from '../../../src/transport/engineCommandPipeline.js';

const PLANT_ID = '61000000-0000-4000-8000-000000000001';
const SECOND_PLANT_ID = '61000000-0000-4000-8000-000000000002';
const HARVEST_INTENT_ID = '62000000-0000-4000-8000-000000000001';
const NORTHERN_LIGHTS_ID = '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7';

function withReadyPlants(count = 1): SimulationWorld {
  const world = createDemoScenario({ companyName: 'Manual Harvest', seed: 'manual-harvest' });
  const structure = world.company.structures[0];
  const room = structure?.rooms.find((entry) => entry.purpose === 'growroom');
  const zone = room?.zones[0];
  if (!structure || !room || !zone) throw new Error('Demo harvest targets missing.');
  const ids = [PLANT_ID, SECOND_PLANT_ID].slice(0, count);
  const plants = ids.map((id, index) => ({
    id,
    slug: `ready-parent-${index + 1}`,
    name: `Ready Parent ${index + 1}`,
    strainId: NORTHERN_LIGHTS_ID,
    lifecycleStage: 'harvest-ready',
    ageHours: 2208,
    health01: 0.9,
    biomass_g: 120 + index * 10,
    containerId: zone.containerId,
    substrateId: zone.substrateId,
    readyForHarvest: true,
    status: 'active',
    moisture01: 0.64,
    quality01: 0.82,
  } satisfies Plant));

  return {
    ...world,
    simTimeHours: 2208,
    company: {
      ...world.company,
      structures: world.company.structures.map((entry) => entry.id === structure.id ? {
        ...entry,
        rooms: entry.rooms.map((candidate) => candidate.id === room.id ? {
          ...candidate,
          zones: candidate.zones.map((item) => item.id === zone.id ? { ...item, plants } : item),
        } : candidate),
      } : entry),
    },
  };
}

function createHarness(initial = withReadyPlants()) {
  let world = initial;
  const set = vi.fn((next: SimulationWorld) => { world = next; });
  const pipeline = createEngineCommandPipeline({ world: { get: () => world, set } });
  const providers = createReadModelProviders({
    world: () => world,
    companyWorld: () => world.company,
    config: createEngineBootstrapConfig('demo'),
  });
  return { get world() { return world; }, set, pipeline, providers };
}

function targets(world: SimulationWorld) {
  const structure = world.company.structures[0];
  const room = structure?.rooms.find((entry) => entry.purpose === 'growroom');
  const zone = room?.zones[0];
  if (!structure || !room || !zone) throw new Error('Demo harvest targets missing.');
  return { structureId: structure.id, roomId: room.id, zoneId: zone.id };
}

describe('R-500 plants.harvest.v1', () => {
  it('keeps ready plants lot-free until intent, then commits one traceable lot per plant', async () => {
    const harness = createHarness(withReadyPlants(2));
    const target = targets(harness.world);
    const before = await harness.providers.readModels();
    const beforeZone = before.structures[0]?.rooms.find((room) => room.id === target.roomId)
      ?.zones.find((zone) => zone.id === target.zoneId);
    expect(before.inventory.lots).toEqual([]);
    expect(beforeZone?.harvestEligibility).toEqual({
      eligible: true,
      plantIds: [PLANT_ID, SECOND_PLANT_ID],
      reasons: [],
    });
    expect(beforeZone?.plants.every((plant) => plant.harvestReady)).toBe(true);

    const intent = {
      type: 'plants.harvest.v1',
      intentId: HARVEST_INTENT_ID,
      ...target,
      plantIds: [PLANT_ID, SECOND_PLANT_ID],
    } as const;
    const first = await harness.pipeline.handle(intent);
    const second = await harness.pipeline.handle(intent);

    expect(second).toEqual(first);
    expect(harness.set).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({
      ok: true,
      status: 'applied',
      result: { command: 'plants.harvest', plantIds: intent.plantIds, replayed: false },
    });
    const after = await harness.providers.readModels();
    expect(after.inventory.lots).toHaveLength(2);
    expect(after.inventory.totalFreshWeightKg).toBe(0.25);
    expect(after.inventory.lots[0]).toMatchObject({
      strainId: NORTHERN_LIGHTS_ID,
      strainName: 'Northern Lights',
      quality01: 0.82,
      moisture01: 0.64,
      structureId: target.structureId,
      source: { plantId: expect.any(String), zoneId: target.zoneId, harvestIntentId: HARVEST_INTENT_ID },
      createdAtTick: 2208,
    });
    const afterZone = after.structures[0]?.rooms.find((room) => room.id === target.roomId)
      ?.zones.find((zone) => zone.id === target.zoneId);
    expect(afterZone?.harvestEligibility.eligible).toBe(false);
    expect(afterZone?.plants.every((plant) => plant.status === 'harvested' && !plant.harvestReady)).toBe(true);
    await expect(harness.pipeline.handle({ ...intent, plantIds: [PLANT_ID] }))
      .rejects.toThrow(/different payload/i);
  });

  it('rejects missing and ambiguous storage without changing authoritative state', async () => {
    const base = withReadyPlants();
    const structure = base.company.structures[0]!;
    const withoutStorage = {
      ...base,
      company: { ...base.company, structures: [{
        ...structure,
        rooms: structure.rooms.filter((room) => room.purpose !== 'storageroom'),
      }] },
    } satisfies SimulationWorld;
    const missing = createHarness(withoutStorage);
    await expect(missing.pipeline.handle({
      type: 'plants.harvest.v1', intentId: HARVEST_INTENT_ID,
      ...targets(withoutStorage), plantIds: [PLANT_ID],
    })).rejects.toThrow(/storage_not_found: Harvest requires a resolvable storage room/i);
    expect(missing.set).not.toHaveBeenCalled();

    const storage = structure.rooms.find((room) => room.purpose === 'storageroom')!;
    const ambiguousWorld = {
      ...base,
      company: { ...base.company, structures: [{
        ...structure,
        rooms: [...structure.rooms, {
          ...storage,
          id: '63000000-0000-4000-8000-000000000001',
          slug: 'second-storage',
          name: 'Second Storage',
        }],
      }] },
    } satisfies SimulationWorld;
    const ambiguous = createHarness(ambiguousWorld);
    await expect(ambiguous.pipeline.handle({
      type: 'plants.harvest.v1', intentId: HARVEST_INTENT_ID,
      ...targets(ambiguousWorld), plantIds: [PLANT_ID],
    })).rejects.toThrow(/storage_ambiguous: Harvest requires exactly one resolvable storage room/i);
    expect(ambiguous.set).not.toHaveBeenCalled();
  });
});
