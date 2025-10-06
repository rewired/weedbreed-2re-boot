import { describe, expect, it } from 'vitest';
import {
  INTENT_ERROR_EVENT,
  INTENT_EVENT,
  SOCKET_ERROR_CODES,
  type TransportAck,
  type TransportIntentEnvelope,
} from '../../../src/transport/adapter.js';
import { createNamespaceClient, createTransportHarness, disconnectClient } from './helpers.js';

describe('transport adapter — intent namespace', () => {
  it('routes valid intents to the provided handler', async () => {
    const received: TransportIntentEnvelope[] = [];
    const harness = await createTransportHarness(async (intent) => {
      received.push(intent);
    });
    let client: Awaited<ReturnType<typeof createNamespaceClient>> | null = null;

    try {
      client = await createNamespaceClient(harness, '/intents');

      const ack = await new Promise<TransportAck>((resolve) => {
        client!.emit(
          INTENT_EVENT,
          {
            type: 'hiring.market.scan',
            structureId: '9f61e55c-8435-4ee3-8b56-8c8c6d00f404',
          },
          (response: TransportAck) => resolve(response)
        );
      });

      expect(ack).toEqual({ ok: true });
      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({ type: 'hiring.market.scan' });
    } finally {
      if (client) {
        await disconnectClient(client);
      }

      await harness.close();
    }
  });

  it('rejects malformed intent payloads', async () => {
    const harness = await createTransportHarness();
    let client: Awaited<ReturnType<typeof createNamespaceClient>> | null = null;

    try {
      client = await createNamespaceClient(harness, '/intents');

      const ack = await new Promise<TransportAck>((resolve) => {
        client!.emit(INTENT_EVENT, 'not-an-object', (response: TransportAck) => resolve(response));
      });

      expect(ack.ok).toBe(false);
      expect(ack.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_INVALID);
    } finally {
      if (client) {
        await disconnectClient(client);
      }

      await harness.close();
    }
  });

  it('rejects unexpected event names on the intents namespace', async () => {
    const harness = await createTransportHarness();
    let client: Awaited<ReturnType<typeof createNamespaceClient>> | null = null;

    try {
      client = await createNamespaceClient(harness, '/intents');

      const errorEvent = new Promise<TransportAck>((resolve) => {
        client!.once(INTENT_ERROR_EVENT, (payload: TransportAck) => resolve(payload));
      });

      const ack = await new Promise<TransportAck>((resolve) => {
        client!.emit('telemetry:rogue', { attempt: true }, (response: TransportAck) => resolve(response));
      });

      const emitted = await errorEvent;

      expect(ack.ok).toBe(false);
      expect(ack.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_CHANNEL_INVALID);
      expect(emitted.ok).toBe(false);
      expect(emitted.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_CHANNEL_INVALID);
    } finally {
      if (client) {
        await disconnectClient(client);
      }

      await harness.close();
    }
  });

  it('propagates deterministic errors when the handler throws', async () => {
    const harness = await createTransportHarness(() => {
      throw new Error('handler exploded');
    });
    let client: Awaited<ReturnType<typeof createNamespaceClient>> | null = null;

    try {
      client = await createNamespaceClient(harness, '/intents');

      const ack = await new Promise<TransportAck>((resolve) => {
        client!.emit(
          INTENT_EVENT,
          { type: 'workforce.raise.accept', employeeId: '04369c77-7cbf-4094-8510-fccf35a20392' },
          (response: TransportAck) => resolve(response)
        );
      });

      expect(ack.ok).toBe(false);
      expect(ack.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR);
      expect(ack.error?.message).toContain('handler exploded');
    } finally {
      if (client) {
        await disconnectClient(client);
      }

      await harness.close();
    }
  });
});
