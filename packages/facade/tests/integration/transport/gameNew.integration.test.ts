import { describe, expect, it, vi } from 'vitest';

/* eslint-disable wb-sim/no-ts-import-js-extension */
import { createEngineBootstrapConfig, type SimulationWorld } from '@wb/engine';
import { createDeterministicWorld } from '../../../src/backend/deterministicWorldLoader.js';
import { createReadModelProviders } from '../../../src/server/readModelProviders.js';
import { createEngineCommandPipeline } from '../../../src/transport/engineCommandPipeline.js';
import { DEFAULT_DEMO_SEED } from '../../../src/intents/game.js';

function createScenario(companyName: string, seed: string): SimulationWorld {
  const seeded = createDeterministicWorld({ seed }).world;
  return {
    ...seeded,
    seed,
    simTimeHours: 0,
    company: { ...seeded.company, name: companyName },
  };
}

describe('game.new.v1 pipeline', () => {
  it('publishes the replacement world before acknowledging and exposes it through read models', async () => {
    let world = createDeterministicWorld({ seed: 'old-seed' }).world;
    const setWorld = vi.fn((next: SimulationWorld) => {
      world = next;
    });
    const pause = vi.fn();
    const pipeline = createEngineCommandPipeline({
      world: { get: () => world, set: setWorld },
      beforeWorldReplace: pause,
    });
    const providers = createReadModelProviders({
      world: () => world,
      companyWorld: () => world.company,
      config: createEngineBootstrapConfig('demo'),
    });

    const acknowledgement = await pipeline.handle({
      type: 'game.new.v1',
      intentId: 'new-game-visible',
      companyName: 'Emerald Labs',
      seed: 'visible-seed',
    });

    expect(pause).toHaveBeenCalledOnce();
    expect(setWorld).toHaveBeenCalledOnce();
    expect(world.seed).toBe('visible-seed');
    expect(world.simTimeHours).toBe(0);
    expect(world.company.structures).toHaveLength(1);
    const rooms = world.company.structures[0]?.rooms ?? [];
    expect(rooms.find((room) => room.purpose === 'growroom')?.zones).toHaveLength(2);
    expect(rooms.filter((room) => room.purpose === 'storageroom')).toHaveLength(1);
    expect(rooms.filter((room) => room.purpose === 'laboratory')).toHaveLength(1);
    expect(acknowledgement).toMatchObject({
      ok: true,
      status: 'applied',
      appliedTick: 0,
      stateAfter: { simTimeHours: 0, paused: true },
      result: { command: 'game.new', companyId: world.company.id, seed: 'visible-seed' },
    });
    await expect(providers.companyTree()).resolves.toMatchObject({
      simTime: 0,
      companyId: world.company.id,
      name: 'Emerald Labs',
    });
  });

  it('replays one successful result without rebuilding or replacing the world twice', async () => {
    let world = createDeterministicWorld({ seed: 'old-seed' }).world;
    const builder = vi.fn(({ companyName, seed }: { companyName: string; seed: string }) =>
      createScenario(companyName, seed),
    );
    const setWorld = vi.fn((next: SimulationWorld) => {
      world = next;
    });
    const pipeline = createEngineCommandPipeline({
      world: { get: () => world, set: setWorld },
      createDemoScenario: builder,
    });
    const intent = {
      type: 'game.new.v1',
      intentId: 'new-game-idempotent',
      companyName: 'Emerald Labs',
      seed: 'same-seed',
    } as const;

    const first = await pipeline.handle(intent);
    const second = await pipeline.handle(intent);

    expect(second).toEqual(first);
    expect(builder).toHaveBeenCalledOnce();
    expect(setWorld).toHaveBeenCalledOnce();
  });

  it('passes the stable default seed to the engine builder when seed is omitted', async () => {
    let world = createDeterministicWorld({ seed: 'old-seed' }).world;
    const builder = vi.fn(({ companyName, seed }: { companyName: string; seed: string }) =>
      createScenario(companyName, seed),
    );
    const pipeline = createEngineCommandPipeline({
      world: { get: () => world, set: (next) => (world = next) },
      createDemoScenario: builder,
    });

    const acknowledgement = await pipeline.handle({
      type: 'game.new.v1',
      intentId: 'new-game-default-seed',
      companyName: 'Emerald Labs',
    });

    expect(builder).toHaveBeenCalledWith({
      companyName: 'Emerald Labs',
      seed: DEFAULT_DEMO_SEED,
    });
    expect(acknowledgement).toMatchObject({ result: { seed: DEFAULT_DEMO_SEED } });
  });

  it('rejects reused intent ids with a different payload', async () => {
    let world = createDeterministicWorld({ seed: 'old-seed' }).world;
    const pipeline = createEngineCommandPipeline({
      world: { get: () => world, set: (next) => (world = next) },
      createDemoScenario: ({ companyName, seed }) => createScenario(companyName, seed),
    });

    await pipeline.handle({
      type: 'game.new.v1',
      intentId: 'new-game-conflict',
      companyName: 'Emerald Labs',
      seed: 'first-seed',
    });

    await expect(
      pipeline.handle({
        type: 'game.new.v1',
        intentId: 'new-game-conflict',
        companyName: 'Emerald Labs',
        seed: 'different-seed',
      }),
    ).rejects.toThrow(/already used with a different payload/i);
  });

  it('does not publish or acknowledge a failed scenario build', async () => {
    const initial = createDeterministicWorld({ seed: 'old-seed' }).world;
    let world = initial;
    const setWorld = vi.fn((next: SimulationWorld) => {
      world = next;
    });
    const pipeline = createEngineCommandPipeline({
      world: { get: () => world, set: setWorld },
      createDemoScenario: () => {
        throw new Error('scenario build failed');
      },
    });

    await expect(
      pipeline.handle({
        type: 'game.new.v1',
        intentId: 'new-game-failed',
        companyName: 'Emerald Labs',
        seed: 'failed-seed',
      }),
    ).rejects.toThrow('scenario build failed');
    expect(setWorld).not.toHaveBeenCalled();
    expect(world).toBe(initial);
  });
});
