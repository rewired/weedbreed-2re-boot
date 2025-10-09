import { afterEach, describe, expect, it } from 'vitest';
import { io as createClient, type Socket } from 'socket.io-client';
import {
  SOCKET_ERROR_CODES,
  TELEMETRY_ERROR_EVENT,
  type TransportAck,
} from '../../../src/transport/adapter.ts';
import {
  createTransportServer,
  type TransportServer,
} from '../../../src/transport/server.ts';
import { disconnectClient, onceConnected } from './helpers.ts';

const TEST_HOST = '127.0.0.1';

describe('transport server bootstrap', () => {
  let server: TransportServer | null = null;
  const activeSockets = new Set<Socket>();

  afterEach(async () => {
    for (const socket of activeSockets) {
      await disconnectClient(socket);
    }

    activeSockets.clear();

    if (server) {
      await server.close();
      server = null;
    }
  });

  it('exposes telemetry and intent namespaces and responds to health checks', async () => {
    server = await createTransportServer({
      host: TEST_HOST,
      port: 0,
      cors: { origin: 'http://localhost:5173' },
      async onIntent() {
        // Intents are not handled during bootstrap; this will be wired by later tracks.
      },
    });

    expect(server.namespaces.telemetry.name).toBe('/telemetry');
    expect(server.namespaces.intents.name).toBe('/intents');
    expect(server.namespaces.telemetry.server.opts.cors?.origin).toBe(
      'http://localhost:5173'
    );

    const healthResponse = await fetch(`${server.url}/healthz`, {
      headers: { Origin: 'http://localhost:5173' },
    });

    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toEqual({ status: 'ok' });
    expect(healthResponse.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173'
    );
  });

  it('rejects telemetry writes when no handler is registered', async () => {
    server = await createTransportServer({
      host: TEST_HOST,
      port: 0,
      async onIntent() {},
    });

    const client = createClient(`${server.url}/telemetry`, {
      transports: ['websocket'],
      forceNew: true,
    });

    activeSockets.add(client);

    await onceConnected(client);

    const errorEvent = new Promise<TransportAck>((resolve) => {
      client.once(TELEMETRY_ERROR_EVENT, (ack: TransportAck) => resolve(ack));
    });

    const ack = await new Promise<TransportAck>((resolve) => {
      client.emit('telemetry:rogue', { attempt: true }, (response: TransportAck) => {
        resolve(response);
      });
    });

    const emittedAck = await errorEvent;

    expect(ack.ok).toBe(false);
    expect(ack.error?.code).toBe(SOCKET_ERROR_CODES.TELEMETRY_WRITE_REJECTED);
    expect(emittedAck.ok).toBe(false);
    expect(emittedAck.error?.code).toBe(SOCKET_ERROR_CODES.TELEMETRY_WRITE_REJECTED);
  });
});
