import { createServer } from 'node:http';
import { io as createClient, type Socket } from 'socket.io-client';
import {
  createSocketTransportAdapter,
  type SocketTransportAdapter,
  type TransportIntentEnvelope,
} from '../../../src/transport/adapter.ts';

function ensureError(candidate: unknown): Error {
  return candidate instanceof Error ? candidate : new Error(String(candidate));
}

export interface TransportHarness {
  readonly port: number;
  readonly adapter: SocketTransportAdapter;
  close(): Promise<void>;
}

export async function createTransportHarness(
  onIntent: (intent: TransportIntentEnvelope) => void | Promise<void> = () => {}
): Promise<TransportHarness> {
  const httpServer = createServer();

  await new Promise<void>((resolve, reject) => {
    const handleError = (error: unknown) => {
      httpServer.off('error', handleError);
      reject(ensureError(error));
    };

    httpServer.once('error', handleError);
    httpServer.listen(0, '127.0.0.1', () => {
      httpServer.off('error', handleError);
      resolve();
    });
  });

  const address = httpServer.address();

  if (!address || typeof address === 'string') {
    throw new Error('Socket server failed to bind to a port.');
  }

  const adapter = createSocketTransportAdapter({
    httpServer,
    onIntent,
  });

  return {
    port: address.port,
    adapter,
    async close() {
      await adapter.close();
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') {
            reject(ensureError(error));
            return;
          }

          resolve();
        });
      });
    },
  } satisfies TransportHarness;
}

export async function createNamespaceClient(
  harness: TransportHarness,
  namespace: '/telemetry' | '/intents'
): Promise<Socket> {
  const portSegment = String(harness.port);
  const socket = createClient(`http://127.0.0.1:${portSegment}${namespace}`, {
    transports: ['websocket'],
    forceNew: true,
  });

  await onceConnected(socket);

  return socket;
}

export function onceConnected(socket: Socket): Promise<void> {
  if (socket.connected) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => {
      socket.off('connect', handleConnect);
      reject(error);
    };

    const handleConnect = () => {
      socket.off('connect_error', handleError);
      resolve();
    };

    socket.once('connect_error', handleError);
    socket.once('connect', handleConnect);
  });
}

export function disconnectClient(socket: Socket): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!socket.connected) {
      socket.disconnect();
      resolve();
      return;
    }

    socket.once('disconnect', () => { resolve(); });
    socket.disconnect();
  });
}
