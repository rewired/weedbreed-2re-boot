import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as createClient, type Socket } from 'socket.io-client';
import { describe, expect, it, vi } from 'vitest';
import {
  INTENT_EVENT,
  SOCKET_ERROR_CODES,
  TELEMETRY_ERROR_EVENT,
  createSocketTransportAdapter,
  type SocketTransportAdapter,
  type TransportAck,
  type TransportIntentEnvelope,
} from '../../src/index.ts';

interface TransportHarness {
  readonly port: number;
  readonly adapter: SocketTransportAdapter;
  close(): Promise<void>;
}

async function createTransportHarness(
  onIntent: (intent: TransportIntentEnvelope) => void | Promise<void> = () => {
    /* noop */
  }
): Promise<TransportHarness> {
  const httpServer = createServer();

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });

  const address = httpServer.address() as AddressInfo | null;

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
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          resolve();
        });
      });
    },
  } satisfies TransportHarness;
}

async function connectNamespace(harness: TransportHarness, namespace: '/telemetry' | '/intents') {
  const socket = createClient(`http://127.0.0.1:${String(harness.port)}${namespace}`, {
    transports: ['websocket'],
    forceNew: true,
  });

  await onceConnected(socket);

  return socket;
}

function onceConnected(socket: Socket): Promise<void> {
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

function disconnectClient(socket: Socket): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!socket.connected) {
      socket.disconnect();
      resolve();
      return;
    }

    socket.once('disconnect', () => {
      resolve();
    });
    socket.disconnect();
  });
}

describe('createSocketTransportAdapter — telemetry read-only contract', () => {
  it('rejects telemetry emits with acknowledgements and mirrors the error event', async () => {
    const onIntent = vi.fn();
    const harness = await createTransportHarness(onIntent);

    const telemetrySocket = await connectNamespace(harness, '/telemetry');

    try {
      const errorEventPromise = new Promise<TransportAck>((resolve) => {
        telemetrySocket.once(TELEMETRY_ERROR_EVENT, (payload: TransportAck) => {
          resolve(payload);
        });
      });

      const ackPromise = new Promise<TransportAck>((resolve) => {
        telemetrySocket.emit('telemetry:write', { topic: 'test' }, (ack: TransportAck) => {
          resolve(ack);
        });
      });

      const [ack, errorPayload] = await Promise.all([ackPromise, errorEventPromise]);

      expect(ack.ok).toBe(false);
      expect(ack.error?.code).toBe(SOCKET_ERROR_CODES.TELEMETRY_WRITE_REJECTED);
      expect(errorPayload).toEqual(ack);
      expect(onIntent).not.toHaveBeenCalled();
    } finally {
      await disconnectClient(telemetrySocket);
      await harness.close();
    }
  });

  it('rejects telemetry emits without acknowledgements', async () => {
    const onIntent = vi.fn();
    const harness = await createTransportHarness(onIntent);

    const telemetrySocket = await connectNamespace(harness, '/telemetry');

    try {
      const errorEventPromise = new Promise<TransportAck>((resolve) => {
        telemetrySocket.once(TELEMETRY_ERROR_EVENT, (payload: TransportAck) => {
          resolve(payload);
        });
      });

      telemetrySocket.emit('telemetry:write', { topic: 'test' });

      const errorPayload = await errorEventPromise;

      expect(errorPayload.ok).toBe(false);
      expect(errorPayload.error?.code).toBe(SOCKET_ERROR_CODES.TELEMETRY_WRITE_REJECTED);
      expect(onIntent).not.toHaveBeenCalled();
    } finally {
      await disconnectClient(telemetrySocket);
      await harness.close();
    }
  });
});

describe('createSocketTransportAdapter — intent submissions', () => {
  it('accepts valid intent submissions with ok acknowledgements', async () => {
    const onIntent = vi.fn();
    const harness = await createTransportHarness(onIntent);
    const intentSocket = await connectNamespace(harness, '/intents');

    try {
      const ack = await new Promise<TransportAck>((resolve) => {
        intentSocket.emit(INTENT_EVENT, { type: 'facility.startup' }, (payload: TransportAck) => {
          resolve(payload);
        });
      });

      expect(ack).toEqual({ ok: true });
      expect(onIntent).toHaveBeenCalledTimes(1);
      expect(onIntent).toHaveBeenCalledWith({ type: 'facility.startup' });
    } finally {
      await disconnectClient(intentSocket);
      await harness.close();
    }
  });

  it('rejects malformed intent submissions with WB_INTENT_INVALID', async () => {
    const onIntent = vi.fn();
    const harness = await createTransportHarness(onIntent);
    const intentSocket = await connectNamespace(harness, '/intents');

    try {
      const ack = await new Promise<TransportAck>((resolve) => {
        intentSocket.emit(INTENT_EVENT, { payload: 'invalid' }, (payload: TransportAck) => {
          resolve(payload);
        });
      });

      expect(ack.ok).toBe(false);
      expect(ack.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_INVALID);
      expect(onIntent).not.toHaveBeenCalled();
    } finally {
      await disconnectClient(intentSocket);
      await harness.close();
    }
  });
});
