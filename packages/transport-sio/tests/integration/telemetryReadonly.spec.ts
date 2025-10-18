import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as createClient } from 'socket.io-client';
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

type SocketClientFactory = (
  url: string,
  options: {
    transports: readonly ['websocket'];
    forceNew: true;
  },
) => unknown;

const createSocketClient: SocketClientFactory = createClient as SocketClientFactory;

interface BaseTestSocket {
  readonly connected: boolean;
  disconnect(): void;
  once(event: 'connect' | 'disconnect', handler: () => void): this;
  once(event: 'connect_error', handler: (error: Error) => void): this;
  off(event: 'connect', handler: () => void): this;
  off(event: 'connect_error', handler: (error: Error) => void): this;
}

interface TelemetrySocket extends BaseTestSocket {
  once(event: typeof TELEMETRY_ERROR_EVENT, handler: (payload: TransportAck) => void): this;
  emit(
    event: 'telemetry:write',
    payload: Record<string, unknown>,
    ack?: (response: TransportAck) => void,
  ): this;
}

interface IntentSocket extends BaseTestSocket {
  emit(event: typeof INTENT_EVENT, payload: unknown, ack: (response: TransportAck) => void): this;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertBaseSocket(value: unknown): asserts value is BaseTestSocket {
  if (!isObject(value)) {
    throw new TypeError('Socket client must be an object.');
  }

  const candidate = value as Partial<BaseTestSocket>;

  if (typeof candidate.connected !== 'boolean') {
    throw new TypeError('Socket client must expose a boolean connected flag.');
  }

  if (typeof candidate.disconnect !== 'function') {
    throw new TypeError('Socket client must expose a disconnect function.');
  }

  if (typeof candidate.once !== 'function') {
    throw new TypeError('Socket client must expose a once function.');
  }

  if (typeof candidate.off !== 'function') {
    throw new TypeError('Socket client must expose an off function.');
  }
}

function assertTelemetrySocket(value: unknown): asserts value is TelemetrySocket {
  assertBaseSocket(value);

  const candidate = value as Partial<TelemetrySocket>;

  if (typeof candidate.emit !== 'function') {
    throw new TypeError('Telemetry socket must expose an emit function.');
  }
}

function assertIntentSocket(value: unknown): asserts value is IntentSocket {
  assertBaseSocket(value);

  const candidate = value as Partial<IntentSocket>;

  if (typeof candidate.emit !== 'function') {
    throw new TypeError('Intent socket must expose an emit function.');
  }
}

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

async function connectNamespace<TSocket extends BaseTestSocket>(
  harness: TransportHarness,
  namespace: '/telemetry' | '/intents',
  assertSocket: (candidate: unknown) => asserts candidate is TSocket,
): Promise<TSocket> {
  const socket: unknown = createSocketClient(`http://127.0.0.1:${String(harness.port)}${namespace}`, {
    transports: ['websocket'],
    forceNew: true,
  });

  assertSocket(socket);

  await onceConnected(socket);

  return socket;
}

function onceConnected(socket: BaseTestSocket): Promise<void> {
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

function disconnectClient(socket: BaseTestSocket): Promise<void> {
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

    const telemetrySocket: TelemetrySocket = await connectNamespace(
      harness,
      '/telemetry',
      assertTelemetrySocket,
    );

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
      expect(ack.status).toBe('rejected');
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

    const telemetrySocket: TelemetrySocket = await connectNamespace(
      harness,
      '/telemetry',
      assertTelemetrySocket,
    );

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
    const intentSocket: IntentSocket = await connectNamespace(
      harness,
      '/intents',
      assertIntentSocket,
    );

    try {
      const ack = await new Promise<TransportAck>((resolve) => {
        intentSocket.emit(INTENT_EVENT, { type: 'facility.startup' }, (payload: TransportAck) => {
          resolve(payload);
        });
      });

      expect(ack).toMatchObject({ ok: true, status: 'queued' });
      expect(ack.intentId ?? null).toBeNull();
      expect(ack.correlationId ?? null).toBeNull();
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
    const intentSocket: IntentSocket = await connectNamespace(
      harness,
      '/intents',
      assertIntentSocket,
    );

    try {
      const ack = await new Promise<TransportAck>((resolve) => {
        intentSocket.emit(INTENT_EVENT, { payload: 'invalid' }, (payload: TransportAck) => {
          resolve(payload);
        });
      });

      expect(ack.ok).toBe(false);
      expect(ack.status).toBe('rejected');
      expect(ack.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_INVALID);
      expect(onIntent).not.toHaveBeenCalled();
    } finally {
      await disconnectClient(intentSocket);
      await harness.close();
    }
  });
});
