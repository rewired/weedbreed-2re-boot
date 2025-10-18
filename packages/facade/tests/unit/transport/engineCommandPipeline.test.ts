import { describe, expect, it } from 'vitest';

/* eslint-disable wb-sim/no-ts-import-js-extension */

import { DEFAULT_WORKFORCE_CONFIG } from '@/backend/src/config/workforce.ts';
import { consumeWorkforceMarketCharges } from '@/backend/src/engine/pipeline/applyWorkforce.ts';
import { createDemoWorld } from '@/backend/src/engine/testHarness.ts';

import { createEngineCommandPipeline } from '../../../src/transport/engineCommandPipeline.js';

describe('createEngineCommandPipeline', () => {
  it('queues hiring market intents and advances the engine world', async () => {
    const initialWorld = createDemoWorld();
    let world = initialWorld;

    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(nextWorld) {
          world = nextWorld;
        },
      },
    });

    const structureId = initialWorld.company.structures[0]?.id;
    if (!structureId) {
      throw new Error('Demo world did not include a structure id for hiring intents.');
    }

    await pipeline.handle({ type: 'hiring.market.scan', structureId });
    pipeline.advanceTick();

    const charges = consumeWorkforceMarketCharges(pipeline.context);
    expect(charges).toBeDefined();
    expect(charges).not.toHaveLength(0);
    expect(charges?.[0]).toMatchObject({
      structureId,
      amountCc: DEFAULT_WORKFORCE_CONFIG.market.scanCost_cc,
    });

    expect(world.workforce.market.structures).not.toEqual(
      initialWorld.workforce.market.structures,
    );
  });

  it('renames structures after the queued tick commits', async () => {
    let world = createDemoWorld();
    const structure = world.company.structures[0];
    if (!structure) {
      throw new Error('Demo world did not include a structure.');
    }

    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(nextWorld) {
          world = nextWorld;
        },
      },
    });

    await pipeline.handle({
      type: 'intent.structure.rename.v1',
      structureId: structure.id,
      name: 'Renamed Demo Facility',
    });

    pipeline.advanceTick();

    const renamedStructure = world.company.structures.find((entry) => entry.id === structure.id);
    expect(renamedStructure?.name).toBe('Renamed Demo Facility');
  });

  it('rejects zone moves into non-growroom targets', async () => {
    let world = createDemoWorld();
    const structure = world.company.structures[0];
    const growRoom = structure?.rooms.find((room) => room.purpose === 'growroom');
    const storageRoom = structure?.rooms.find((room) => room.purpose === 'storageroom');
    const zone = growRoom?.zones[0];

    if (!structure || !growRoom || !storageRoom || !zone) {
      throw new Error('Demo world lacks expected rooms/zones for the move validation test.');
    }

    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(nextWorld) {
          world = nextWorld;
        },
      },
    });

    await expect(
      pipeline.handle({
        type: 'intent.zone.move.v1',
        structureId: structure.id,
        zoneId: zone.id,
        targetRoomId: storageRoom.id,
      }),
    ).rejects.toThrow(/growroom/i);
  });

  it('moves zones into eligible growrooms', async () => {
    let world = createDemoWorld();
    const structure = world.company.structures[0];
    const sourceRoom = structure?.rooms.find((room) => room.purpose === 'growroom');
    const zone = sourceRoom?.zones[0];

    if (!structure || !sourceRoom || !zone) {
      throw new Error('Demo world lacks expected growroom data for zone move tests.');
    }

    const targetRoom = {
      ...sourceRoom,
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Expansion Grow Room',
      zones: [],
      devices: [],
    } as typeof sourceRoom;

    structure.rooms = [...structure.rooms, targetRoom];

    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(nextWorld) {
          world = nextWorld;
        },
      },
    });

    await pipeline.handle({
      type: 'intent.zone.move.v1',
      structureId: structure.id,
      zoneId: zone.id,
      targetRoomId: targetRoom.id,
    });

    pipeline.advanceTick();

    const movedZoneSourceRoom = world.company.structures[0]?.rooms.find((room) => room.id === sourceRoom.id);
    const movedZoneTargetRoom = world.company.structures[0]?.rooms.find((room) => room.id === targetRoom.id);

    expect(movedZoneSourceRoom?.zones.some((entry) => entry.id === zone.id)).toBe(false);
    expect(movedZoneTargetRoom?.zones.some((entry) => entry.id === zone.id)).toBe(true);
  });

  it('rejects unsupported intent types', async () => {
    const initialWorld = createDemoWorld();
    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => initialWorld,
        set() {
          throw new Error('set should not be called for unsupported intents');
        },
      },
    });

    await expect(
      pipeline.handle({ type: 'unknown.intent', attempt: true }),
    ).rejects.toThrow(/Unsupported intent type/i);
  });

  it('rejects malformed workforce payloads with validation errors', async () => {
    let world = createDemoWorld();
    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(next) {
          world = next;
        },
      },
    });

    await expect(
      pipeline.handle({ type: 'hiring.market.scan' }),
    ).rejects.toThrow(/failed validation/i);
  });
});

