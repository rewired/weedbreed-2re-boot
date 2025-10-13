import { afterEach, describe, expect, it } from 'vitest';
import { io as createClient, type Socket } from 'socket.io-client';
import {
  SOCKET_ERROR_CODES,
  TELEMETRY_ERROR_EVENT,
  type TransportAck,
} from '../../../src/transport/adapter.ts';
import {
  createTransportServer,
  type TransportCorsOptions,
  type TransportServer,
} from '../../../src/transport/server.ts';
import { disconnectClient, onceConnected } from './helpers.ts';

const TEST_HOST = '127.0.0.1';

function extractCorsOrigin(server: TransportServer, namespace: 'telemetry' | 'intents'): string | undefined {
  const socketNamespace = server.namespaces[namespace] as unknown;
  if (!socketNamespace || typeof socketNamespace !== 'object') {
    return undefined;
  }

  const socketServer = (socketNamespace as { server?: unknown }).server;
  if (!socketServer || typeof socketServer !== 'object') {
    return undefined;
  }

  const opts = (socketServer as { opts?: unknown }).opts;
  if (!opts || typeof opts !== 'object') {
    return undefined;
  }

  const cors = (opts as { cors?: TransportCorsOptions }).cors;
  return cors?.origin;
}

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
    server = (await createTransportServer({
      host: TEST_HOST,
      port: 0,
      cors: { origin: 'http://localhost:5173' },
      onIntent(intent) {
        void intent;
      },
    }));

    expect(server.namespaces.telemetry.name).toBe('/telemetry');
    expect(server.namespaces.intents.name).toBe('/intents');

    expect(extractCorsOrigin(server, 'telemetry')).toBe('http://localhost:5173');

    const healthResponse = await fetch(`${server.url}/healthz`, {
      headers: { Origin: 'http://localhost:5173' },
    });

    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toEqual({ status: 'ok' });
    expect(healthResponse.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173'
    );

    const headResponse = await fetch(`${server.url}/healthz`, {
      method: 'HEAD',
      headers: { Origin: 'http://localhost:5173' },
    });

    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173'
    );
    expect(headResponse.headers.get('content-type')).toBe(
      'application/json; charset=utf-8'
    );
  });

  it('rejects telemetry writes when no handler is registered', async () => {
    server = (await createTransportServer({
      host: TEST_HOST,
      port: 0,
      onIntent(intent) {
        void intent;
      },
    }));

    const client = createClient(`${server.url}/telemetry`, {
      transports: ['websocket'],
      forceNew: true,
    });

    activeSockets.add(client);

    await onceConnected(client);

    const errorEvent = new Promise<TransportAck>((resolve) => {
      client.once(TELEMETRY_ERROR_EVENT, (ack: TransportAck) => { resolve(ack); });
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




