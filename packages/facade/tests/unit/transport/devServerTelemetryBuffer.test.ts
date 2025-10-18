/* eslint-disable wb-sim/no-ts-import-js-extension */

import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TransportServer } from '../../../src/transport/server.js';

type TelemetryEnvelope = Parameters<TransportServer['publishTelemetry']>[0];

let transportServerStub: TransportServer | null = null;

vi.mock('../../../src/transport/engineCommandPipeline.js', () => ({
  createEngineCommandPipeline: vi.fn(() => ({
    advanceTick: vi.fn(),
    handle: vi.fn(),
  })),
}));

const playbackControllers: ReturnType<typeof createPlaybackControllerStub>[] = [];

function createPlaybackControllerStub(options: { onTick?: () => void }) {
  return {
    play: vi.fn(),
    pause: vi.fn(),
    step: vi.fn(() => {
      options.onTick?.();
    }),
    setSpeed: vi.fn(),
    dispose: vi.fn(),
  };
}

vi.mock('../../../src/transport/playbackController.js', () => ({
  createPlaybackController: vi.fn((options: { onTick?: () => void }) => {
    const controller = createPlaybackControllerStub(options);
    playbackControllers.push(controller);
    return controller;
  }),
}));

vi.mock('../../../src/backend/deterministicWorldLoader.js', () => ({
  createDeterministicWorld: vi.fn(() => ({
    world: { simTimeHours: 0 },
  })),
}));

vi.mock('../../../src/transport/server.js', () => ({
  createTransportServer: vi.fn(() => {
    if (!transportServerStub) {
      throw new Error('Transport server stub not configured.');
    }

    return Promise.resolve(transportServerStub);
  }),
}));

import { startFacadeDevServer } from '../../../src/transport/devServer.ts';

class NamespaceStub extends EventEmitter {
  readonly sockets = new Map<string, object>();
}

function createTransportServerStub() {
  const telemetryNamespace = new NamespaceStub();
  const intentsNamespace = new NamespaceStub();
  const published: TelemetryEnvelope[] = [];
  const publishTelemetry = vi.fn((event: TelemetryEnvelope) => {
    published.push(event);
  });

  const server: TransportServer = {
    host: '127.0.0.1',
    port: 0,
    url: 'http://127.0.0.1:0',
    namespaces: {
      telemetry: telemetryNamespace as unknown as TransportServer['namespaces']['telemetry'],
      intents: intentsNamespace as unknown as TransportServer['namespaces']['intents'],
    },
    publishTelemetry,
    async close() {
      // No-op for tests.
    },
  } satisfies TransportServer;

  return {
    server,
    telemetryNamespace,
    intentsNamespace,
    published,
    publishTelemetry,
  } as const;
}

describe('startFacadeDevServer telemetry buffer', () => {
  beforeEach(() => {
    process.env.WB_FACADE_DEBUG_TELEMETRY = 'false';
  });

  afterEach(() => {
    delete process.env.WB_FACADE_DEBUG_TELEMETRY;
    transportServerStub = null;
    playbackControllers.splice(0, playbackControllers.length);
    vi.clearAllMocks();
  });

  it('flushes pending telemetry when a client connects', async () => {
    const stub = createTransportServerStub();
    transportServerStub = stub.server;

    const devServer = await startFacadeDevServer();

    try {
      devServer.context.telemetry.emit('telemetry.topic', { foo: 'bar' });

      expect(stub.publishTelemetry).not.toHaveBeenCalled();

      stub.telemetryNamespace.sockets.set('socket-1', {});
      stub.telemetryNamespace.emit('connection', {});

      expect(stub.publishTelemetry).toHaveBeenCalledTimes(1);
      expect(stub.published).toEqual([
        { topic: 'telemetry.topic', payload: { foo: 'bar' } },
      ]);
    } finally {
      await devServer.stop();
    }
  });

  it('queues telemetry when all clients disconnect and flushes on reconnect', async () => {
    const stub = createTransportServerStub();
    transportServerStub = stub.server;

    const devServer = await startFacadeDevServer();

    try {
      stub.telemetryNamespace.sockets.set('socket-initial', {});
      stub.telemetryNamespace.emit('connection', {});

      devServer.context.telemetry.emit('telemetry.topic', { sequence: 1 });
      expect(stub.publishTelemetry).toHaveBeenCalledTimes(1);

      stub.telemetryNamespace.sockets.clear();

      devServer.context.telemetry.emit('telemetry.topic', { sequence: 2 });
      expect(stub.publishTelemetry).toHaveBeenCalledTimes(1);

      stub.telemetryNamespace.sockets.set('socket-reconnect', {});
      stub.telemetryNamespace.emit('connection', {});

      expect(stub.publishTelemetry).toHaveBeenCalledTimes(2);
      expect(stub.published).toEqual([
        { topic: 'telemetry.topic', payload: { sequence: 1 } },
        { topic: 'telemetry.topic', payload: { sequence: 2 } },
      ]);
    } finally {
      await devServer.stop();
    }
  });
});

