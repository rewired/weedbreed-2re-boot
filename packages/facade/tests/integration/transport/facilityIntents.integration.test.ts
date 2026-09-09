/* eslint-disable wb-sim/no-ts-import-js-extension */
import { describe, expect, it, vi } from 'vitest';

import { createDemoScenario, createEngineBootstrapConfig, type SimulationWorld } from '@wb/engine';
import { createReadModelProviders } from '../../../src/server/readModelProviders.js';
import { createEngineCommandPipeline } from '../../../src/transport/engineCommandPipeline.js';

const CULTIVATION_ID = '85cc0916-0e8a-495e-af8f-50291abe6855';
const CONTAINER_ID = '0c48f3e3-2c19-4be4-86ea-4de97f5aa51e';
const SUBSTRATE_ID = '04c8b1a5-09cc-4d86-8dc6-9007a64de6f2';
const IRRIGATION_ID = 'b7a5d5fa-6561-4a1c-93c8-2d3f9a11c201';
const LED_ID = '3b5f6ad7-672e-47cd-9a24-f0cc45c4101e';
const COOL_AIR_ID = '7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b';

function intentId(sequence: number): string {
  return `10000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

function createHarness(initialWorld = createDemoScenario({ companyName: 'Facility Test', seed: 'facility-test' })) {
  let world = initialWorld;
  const set = vi.fn((next: SimulationWorld) => {
    world = next;
  });
  const pipeline = createEngineCommandPipeline({ world: { get: () => world, set } });
  const providers = createReadModelProviders({
    world: () => world,
    companyWorld: () => world.company,
    config: createEngineBootstrapConfig('demo'),
  });
  return { get world() { return world; }, set, pipeline, providers };
}

function demoTargets(world: SimulationWorld) {
  const structure = world.company.structures[0];
  const growroom = structure?.rooms.find((room) => room.purpose === 'growroom');
  const laboratory = structure?.rooms.find((room) => room.purpose === 'laboratory');
  const zone = growroom?.zones[0];
  if (!structure || !growroom || !laboratory || !zone) throw new Error('Demo facility is incomplete.');
  return { structure, growroom, laboratory, zone };
}

describe('R-200 facility intents', () => {
  it('commits a room before ack and replays the same ack exactly once', async () => {
    const seeded = createDemoScenario({ companyName: 'Facility Test', seed: 'room-create' });
    const structure = seeded.company.structures[0];
    if (!structure) throw new Error('Demo structure missing.');
    const world = {
      ...seeded,
      company: { ...seeded.company, structures: [{ ...structure, rooms: structure.rooms.slice(0, 2) }] },
    } as SimulationWorld;
    const harness = createHarness(world);
    const intent = {
      type: 'room.create.v1', intentId: intentId(1), structureId: structure.id,
      name: 'New Laboratory', purpose: 'laboratory', floorArea_m2: 5,
    } as const;

    const first = await harness.pipeline.handle(intent);
    const second = await harness.pipeline.handle(intent);

    expect(second).toEqual(first);
    expect(harness.set).toHaveBeenCalledOnce();
    expect(harness.world.company.structures[0]?.rooms.some((room) => room.name === 'New Laboratory')).toBe(true);

    await expect(harness.pipeline.handle({ ...intent, name: 'Conflicting Name' }))
      .rejects.toThrow(/different payload/i);
  });

  it('rejects zones outside growrooms, incompatible configuration and capacity overflow', async () => {
    const seeded = createDemoScenario({ companyName: 'Facility Test', seed: 'zone-rejections' });
    const seededTargets = demoTargets(seeded);
    const emptyGrowroom = { ...seededTargets.growroom, zones: [] };
    const availableWorld = {
      ...seeded,
      company: {
        ...seeded.company,
        structures: [{
          ...seededTargets.structure,
          rooms: seededTargets.structure.rooms.map((room) =>
            room.id === emptyGrowroom.id ? emptyGrowroom : room),
        }],
      },
    } as SimulationWorld;
    const harness = createHarness(availableWorld);
    const { structure, laboratory } = seededTargets;
    const targetGrowroom = harness.world.company.structures[0]?.rooms.find(
      (room) => room.id === emptyGrowroom.id,
    );
    if (!targetGrowroom) throw new Error('Available growroom missing.');
    const base = {
      type: 'zone.create.v1', structureId: structure.id, floorArea_m2: 2.5,
      cultivationMethodId: CULTIVATION_ID, containerId: CONTAINER_ID,
      substrateId: SUBSTRATE_ID, irrigationMethodId: IRRIGATION_ID,
    } as const;

    await expect(harness.pipeline.handle({ ...base, intentId: intentId(2), roomId: laboratory.id }))
      .rejects.toThrow(/only be created inside growrooms/i);
    await expect(harness.pipeline.handle({
      ...base, intentId: intentId(3), roomId: targetGrowroom.id,
      irrigationMethodId: '00000000-0000-4000-8000-000000000099',
    })).rejects.toThrow(/unknown or incompatible/i);
    await expect(harness.pipeline.handle({
      ...base, intentId: intentId(4), roomId: targetGrowroom.id, floorArea_m2: 20,
    })).rejects.toThrow(/capacity is insufficient/i);
    expect(harness.set).not.toHaveBeenCalled();
  });

  it('rejects invalid device placement authoritatively', async () => {
    const seeded = createDemoScenario({ companyName: 'Facility Test', seed: 'bad-placement' });
    const { structure, growroom, laboratory, zone } = demoTargets(seeded);
    const invalidLaboratory = { ...laboratory, zones: [zone] } as typeof laboratory;
    const emptiedGrowroom = { ...growroom, zones: growroom.zones.filter((entry) => entry.id !== zone.id) };
    const world = {
      ...seeded,
      company: {
        ...seeded.company,
        structures: [{
          ...structure,
          rooms: structure.rooms.map((room) => room.id === growroom.id
            ? emptiedGrowroom
            : room.id === laboratory.id ? invalidLaboratory : room),
        }],
      },
    } as SimulationWorld;
    const harness = createHarness(world);

    await expect(harness.pipeline.handle({
      type: 'device.purchaseInstall.v1', intentId: intentId(5), structureId: structure.id,
      roomId: laboratory.id, zoneId: zone.id, deviceBlueprintId: LED_ID,
    })).rejects.toThrow(/cannot be installed/i);
    expect(harness.set).not.toHaveBeenCalled();
  });

  it('shows installed devices, booked real cost and readiness after authoritative commits', async () => {
    const harness = createHarness();
    const { structure, growroom, zone } = demoTargets(harness.world);
    const before = await harness.providers.readModels();
    const beforeZone = before.structures[0]?.rooms
      .find((room) => room.id === growroom.id)?.zones.find((entry) => entry.id === zone.id);
    expect(beforeZone?.readiness).toMatchObject({ status: 'missing-prerequisites' });

    let lastAck: Awaited<ReturnType<typeof harness.pipeline.handle>>;
    for (let index = 0; index < 7; index += 1) {
      lastAck = await harness.pipeline.handle({
        type: 'device.purchaseInstall.v1', intentId: intentId(10 + index),
        structureId: structure.id, roomId: growroom.id, zoneId: zone.id,
        deviceBlueprintId: LED_ID,
      });
    }
    lastAck = await harness.pipeline.handle({
      type: 'device.purchaseInstall.v1', intentId: intentId(20),
      structureId: structure.id, roomId: growroom.id, zoneId: zone.id,
      deviceBlueprintId: COOL_AIR_ID,
    });

    expect(lastAck).toMatchObject({
      ok: true,
      status: 'applied',
      result: {
        command: 'device.purchaseInstall',
        purchaseCost: {
          amountCc: 1200,
          booking: 'booked',
          ledgerEntryId: expect.any(String),
          balanceAfterCc: 14600,
        },
      },
    });
    const after = await harness.providers.readModels();
    const afterZone = after.structures[0]?.rooms
      .find((room) => room.id === growroom.id)?.zones.find((entry) => entry.id === zone.id);
    expect(afterZone?.devices).toHaveLength(8);
    expect(afterZone?.readiness).toEqual({ status: 'ready', missingPrerequisites: [] });
    expect(after.priceBook.devices).toEqual(expect.arrayContaining([
      expect.objectContaining({ deviceBlueprintId: LED_ID, capitalExpenditure: 600 }),
      expect.objectContaining({ deviceBlueprintId: COOL_AIR_ID, capitalExpenditure: 1200 }),
    ]));
  });
});
