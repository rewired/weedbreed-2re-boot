/* eslint-disable wb-sim/no-ts-import-js-extension */
import { describe, expect, it, vi } from 'vitest';

import { createDemoScenario, createEngineBootstrapConfig, type SimulationWorld } from '@wb/engine';
import { createReadModelProviders } from '../../../src/server/readModelProviders.js';
import { createEngineCommandPipeline } from '../../../src/transport/engineCommandPipeline.js';

const NORTHERN_LIGHTS_ID = '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7';
const SOUR_DIESEL_ID = '8b9a0b6c-2d6c-4f58-9c37-7a6c9d4aa5c2';
const LED_ID = '3b5f6ad7-672e-47cd-9a24-f0cc45c4101e';
const COOL_AIR_ID = '7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b';

function intentId(sequence: number): string {
  return `20000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

function createHarness() {
  let world = createDemoScenario({ companyName: 'Parent Grow', seed: 'parent-grow' });
  const set = vi.fn((next: SimulationWorld) => { world = next; });
  const pipeline = createEngineCommandPipeline({ world: { get: () => world, set } });
  const providers = createReadModelProviders({
    world: () => world,
    companyWorld: () => world.company,
    config: createEngineBootstrapConfig('demo'),
  });
  return { get world() { return world; }, set, pipeline, providers };
}

function targets(world: SimulationWorld, zoneIndex = 0) {
  const structure = world.company.structures[0];
  const room = structure?.rooms.find((entry) => entry.purpose === 'growroom');
  const zone = room?.zones[zoneIndex];
  if (!structure || !room || !zone) throw new Error('Demo grow targets missing.');
  return { structureId: structure.id, roomId: room.id, zoneId: zone.id };
}

async function installRequiredDevices(
  harness: ReturnType<typeof createHarness>,
  zoneIndex: number,
  sequenceBase: number,
): Promise<void> {
  const target = targets(harness.world, zoneIndex);
  for (let index = 0; index < 7; index += 1) {
    await harness.pipeline.handle({
      type: 'device.purchaseInstall.v1',
      intentId: intentId(sequenceBase + index),
      ...target,
      deviceBlueprintId: LED_ID,
    });
  }
  await harness.pipeline.handle({
    type: 'device.purchaseInstall.v1',
    intentId: intentId(sequenceBase + 7),
    ...target,
    deviceBlueprintId: COOL_AIR_ID,
  });
}

describe('R-300 plants.sow.v1', () => {
  it('rejects non-ready, unknown-strain and over-capacity submissions without publishing state', async () => {
    const harness = createHarness();
    const target = targets(harness.world);

    await expect(harness.pipeline.handle({
      type: 'plants.sow.v1', intentId: intentId(1), ...target,
      strainId: NORTHERN_LIGHTS_ID, count: 1,
    })).rejects.toThrow(/zone_not_ready/i);
    await installRequiredDevices(harness, 0, 10);
    const publishesAfterSetup = harness.set.mock.calls.length;
    await expect(harness.pipeline.handle({
      type: 'plants.sow.v1', intentId: intentId(2), ...target,
      strainId: '00000000-0000-4000-8000-000000000099', count: 1,
    })).rejects.toThrow(/strain_not_found/i);
    await expect(harness.pipeline.handle({
      type: 'plants.sow.v1', intentId: intentId(3), ...target,
      strainId: NORTHERN_LIGHTS_ID, count: 16,
    })).rejects.toThrow(/capacity_exceeded/i);
    expect(harness.set).toHaveBeenCalledTimes(publishesAfterSetup);
  });

  it('commits before ack, exposes canonical plant progress and replays without a second mutation', async () => {
    const harness = createHarness();
    await installRequiredDevices(harness, 0, 30);
    const target = targets(harness.world);
    const intent = {
      type: 'plants.sow.v1', intentId: intentId(40), ...target,
      strainId: NORTHERN_LIGHTS_ID, count: 2,
    } as const;
    const beforeSowPublishes = harness.set.mock.calls.length;

    const first = await harness.pipeline.handle(intent);
    const second = await harness.pipeline.handle(intent);

    expect(second).toEqual(first);
    expect(harness.set).toHaveBeenCalledTimes(beforeSowPublishes + 1);
    expect(first).toMatchObject({
      ok: true,
      status: 'applied',
      result: {
        command: 'plants.sow',
        strainId: NORTHERN_LIGHTS_ID,
        count: 2,
        replayed: false,
        seedCost: {
          unitPriceCc: 0.7,
          quantity: 2,
          amountCc: 1.4,
          booking: 'booked',
          ledgerEntryId: expect.any(String),
          balanceAfterCc: 14598.6,
        },
      },
    });

    const snapshot = await harness.providers.readModels();
    const zone = snapshot.structures[0]?.rooms
      .find((room) => room.id === target.roomId)?.zones.find((entry) => entry.id === target.zoneId);
    expect(zone?.plants).toHaveLength(2);
    expect(zone?.plants[0]).toMatchObject({
      strainId: NORTHERN_LIGHTS_ID,
      strainName: 'Northern Lights',
      phase: 'seedling',
      ageHours: 0,
      health01: 1,
      biomassKg: 0.001,
      estimatedMaturityAtSimHour: 2208,
      estimatedRemainingHours: 2208,
    });
    expect(zone?.sowEligibility).toMatchObject({ eligible: false, reasons: ['zone-not-empty'] });
    expect(zone?.strainChoices).toEqual(expect.arrayContaining([
      expect.objectContaining({ strainId: NORTHERN_LIGHTS_ID, name: 'Northern Lights', seedPriceCc: 0.7 }),
      expect.objectContaining({ strainId: SOUR_DIESEL_ID, name: 'Sour Diesel', seedPriceCc: 0.8 }),
    ]));

    await expect(harness.pipeline.handle({ ...intent, count: 3 })).rejects.toThrow(/different payload/i);
    await expect(harness.pipeline.handle({ ...intent, intentId: intentId(41) })).rejects.toThrow(/zone_not_empty/i);
  });

  it('supports Northern Lights and Sour Diesel simultaneously in separate zones', async () => {
    const harness = createHarness();
    await installRequiredDevices(harness, 0, 50);
    await installRequiredDevices(harness, 1, 60);
    const northernTarget = targets(harness.world, 0);
    const sourTarget = targets(harness.world, 1);

    await harness.pipeline.handle({
      type: 'plants.sow.v1', intentId: intentId(70), ...northernTarget,
      strainId: NORTHERN_LIGHTS_ID, count: 1,
    });
    await harness.pipeline.handle({
      type: 'plants.sow.v1', intentId: intentId(71), ...sourTarget,
      strainId: SOUR_DIESEL_ID, count: 1,
    });

    const snapshot = await harness.providers.readModels();
    const zones = snapshot.structures[0]?.rooms.find((room) => room.id === northernTarget.roomId)?.zones;
    expect(zones?.[0]?.plants[0]?.strainName).toBe('Northern Lights');
    expect(zones?.[1]?.plants[0]?.strainName).toBe('Sour Diesel');
  });

  it('does not count harvested plant history as occupied sowing capacity', async () => {
    const harness = createHarness();
    await installRequiredDevices(harness, 0, 80);
    const target = targets(harness.world);
    await harness.pipeline.handle({
      type: 'plants.sow.v1', intentId: intentId(90), ...target,
      strainId: NORTHERN_LIGHTS_ID, count: 2,
    });
    const historyWorld: SimulationWorld = {
      ...harness.world,
      company: {
        ...harness.world.company,
        structures: harness.world.company.structures.map((structure) => ({
          ...structure,
          rooms: structure.rooms.map((room) => ({
            ...room,
            zones: room.zones.map((zone) => zone.id === target.zoneId
              ? { ...zone, plants: zone.plants.map((plant) => ({ ...plant, status: 'harvested' as const })) }
              : zone),
          })),
        })),
      },
    };
    const providers = createReadModelProviders({
      world: historyWorld,
      companyWorld: historyWorld.company,
      config: createEngineBootstrapConfig('demo'),
    });
    const snapshot = await providers.readModels();
    const zone = snapshot.structures[0]!.rooms.find((room) => room.id === target.roomId)!.zones
      .find((entry) => entry.id === target.zoneId)!;
    expect(zone.plants).toHaveLength(2);
    expect(zone.currentPlantCount).toBe(0);
    expect(zone.sowEligibility).toMatchObject({ eligible: true, reasons: [] });
  });
});
