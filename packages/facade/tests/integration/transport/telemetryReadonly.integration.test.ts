import { describe, expect, it } from 'vitest';
import {
  SOCKET_ERROR_CODES,
  TELEMETRY_ERROR_EVENT,
  TELEMETRY_EVENT,
  type TelemetryEvent,
  type TransportAck,
} from '../../../src/transport/adapter.js';
import { createNamespaceClient, createTransportHarness, disconnectClient } from './helpers.js';

describe('transport adapter — telemetry namespace', () => {
  it('broadcasts telemetry events to subscribed clients', async () => {
    const harness = await createTransportHarness();
    let client: Awaited<ReturnType<typeof createNamespaceClient>> | null = null;

    try {
      client = await createNamespaceClient(harness, '/telemetry');

      const received = new Promise<TelemetryEvent>((resolve) => {
        client!.once(TELEMETRY_EVENT, (event: TelemetryEvent) => resolve(event));
      });

      harness.adapter.publishTelemetry({
        topic: 'telemetry.test.event.v1',
        payload: { ok: true },
      });

      await expect(received).resolves.toEqual({
        topic: 'telemetry.test.event.v1',
        payload: { ok: true },
      });
    } finally {
      if (client) {
        await disconnectClient(client);
      }

      await harness.close();
    }
  });

  it('rejects inbound telemetry writes with a deterministic error code', async () => {
    const harness = await createTransportHarness();
    let client: Awaited<ReturnType<typeof createNamespaceClient>> | null = null;

    try {
      client = await createNamespaceClient(harness, '/telemetry');

      const errorEvent = new Promise<TransportAck>((resolve) => {
        client!.once(TELEMETRY_ERROR_EVENT, (ack: TransportAck) => resolve(ack));
      });

      const ack = await new Promise<TransportAck>((resolve) => {
        client!.emit('telemetry:rogue', { attempt: true }, (response: TransportAck) => resolve(response));
      });

      const eventAck = await errorEvent;

      expect(ack.ok).toBe(false);
      expect(ack.error?.code).toBe(SOCKET_ERROR_CODES.TELEMETRY_WRITE_REJECTED);
      expect(eventAck.ok).toBe(false);
      expect(eventAck.error?.code).toBe(SOCKET_ERROR_CODES.TELEMETRY_WRITE_REJECTED);
    } finally {
      if (client) {
        await disconnectClient(client);
      }

      await harness.close();
    }
  });
});
