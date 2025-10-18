import { describe, expect, it } from 'vitest';

/* eslint-disable wb-sim/no-ts-import-js-extension */

import { type EngineRunContext } from '@/backend/src/engine/Engine.ts';
import { consumeWorkforceMarketCharges } from '@/backend/src/engine/pipeline/applyWorkforce.ts';
import { createDemoWorld } from '@/backend/src/engine/testHarness.ts';

import {
  INTENT_EVENT,
  SOCKET_ERROR_CODES,
  type TransportAck,
} from '../../../src/transport/adapter.ts';
import { createEngineCommandPipeline } from '../../../src/transport/engineCommandPipeline.js';
import {
  createNamespaceClient,
  createTransportHarness,
  disconnectClient,
} from './helpers.ts';

describe('transport intent forwarding', () => {
  it('acknowledges successful workforce intents after forwarding to the engine pipeline', async () => {
    let world = createDemoWorld();
    const context: EngineRunContext = {};
    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(nextWorld) {
          world = nextWorld;
        },
      },
      context,
    });

    const structureId = world.company.structures[0]?.id;
    if (!structureId) {
      throw new Error('Demo world missing structure id for hiring market scan intent.');
    }

    const harness = await createTransportHarness(async (intent) => {
      await pipeline.handle(intent);
      pipeline.advanceTick();
    });
    let client: Awaited<ReturnType<typeof createNamespaceClient>> | null = null;

    try {
      client = await createNamespaceClient(harness, '/intents');

      const ack = await new Promise<TransportAck>((resolve) => {
        client.emit(
          INTENT_EVENT,
          { type: 'hiring.market.scan', structureId },
          (response: TransportAck) => {
            resolve(response);
          },
        );
      });

      expect(ack).toMatchObject({ ok: true, status: 'queued' });
      expect(ack.intentId ?? null).toBeNull();
      expect(ack.correlationId ?? null).toBeNull();

      const charges = consumeWorkforceMarketCharges(context);
      expect(charges).toBeDefined();
      expect(charges).not.toHaveLength(0);
      expect(charges?.[0]).toMatchObject({ structureId });
    } finally {
      if (client) {
        await disconnectClient(client);
      }
      await harness.close();
    }
  });

  it('propagates pipeline failures as deterministic transport errors', async () => {
    let world = createDemoWorld();
    const context: EngineRunContext = {};
    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set(nextWorld) {
          world = nextWorld;
        },
      },
      context,
    });

    const harness = await createTransportHarness(async (intent) => {
      await pipeline.handle(intent);
      pipeline.advanceTick();
    });
    let client: Awaited<ReturnType<typeof createNamespaceClient>> | null = null;

    try {
      client = await createNamespaceClient(harness, '/intents');

      const ack = await new Promise<TransportAck>((resolve) => {
        client.emit(INTENT_EVENT, { type: 'hiring.market.scan' }, (response: TransportAck) => {
          resolve(response);
        });
      });

      expect(ack.ok).toBe(false);
      expect(ack.status).toBe('rejected');
      expect(ack.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR);
      expect(ack.error?.message).toMatch(/validation/i);
    } finally {
      if (client) {
        await disconnectClient(client);
      }
      await harness.close();
    }
  });
});

