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

