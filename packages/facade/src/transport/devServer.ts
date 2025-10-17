import process from 'node:process';
import { pathToFileURL } from 'node:url';
/* eslint-disable wb-sim/no-ts-import-js-extension */

import { type EngineRunContext } from '@/backend/src/engine/Engine.ts';
import { createDemoWorld } from '@/backend/src/engine/testHarness.ts';

import {
  createEngineCommandPipeline,
  type EngineCommandPipeline,
} from './engineCommandPipeline.js';
import {
  createTransportServer,
  type TransportCorsOptions,
  type TransportServer,
} from './server.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 7101;
const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';

type TelemetryEnvelope = Parameters<TransportServer['publishTelemetry']>[0];

export interface StartFacadeDevServerOptions {
  readonly host?: string;
  readonly port?: number;
  readonly cors?: TransportCorsOptions;
  readonly corsOrigin?: string;
  readonly world?: ReturnType<typeof createDemoWorld>;
  readonly context?: EngineRunContext;
}

export interface FacadeDevServerInstance {
  readonly server: TransportServer;
  readonly pipeline: EngineCommandPipeline;
  readonly context: EngineRunContext;
  stop(): Promise<void>;
}

export async function startFacadeDevServer(
  options: StartFacadeDevServerOptions = {}
): Promise<FacadeDevServerInstance> {
  let world = options.world ?? createDemoWorld();
  const baseContext: EngineRunContext = options.context ?? {};
  const upstreamTelemetry = baseContext.telemetry;
  const pendingTelemetry: TelemetryEnvelope[] = [];
  let publisher: TransportServer['publishTelemetry'] | null = null;

  const telemetryBridge: EngineRunContext['telemetry'] = {
    emit(topic, payload) {
      const envelope: TelemetryEnvelope = { topic, payload };

      if (publisher) {
        publisher(envelope);
      } else {
        pendingTelemetry.push(envelope);
      }

      upstreamTelemetry?.emit(topic, payload);
    },
  } satisfies EngineRunContext['telemetry'];

  const context: EngineRunContext = {
    ...baseContext,
    telemetry: telemetryBridge,
  } satisfies EngineRunContext;

  const pipeline = createEngineCommandPipeline({
    world: {
      get: () => world,
      set(nextWorld) {
        world = nextWorld;
      },
    },
    context,
  });

  const cors: TransportCorsOptions | undefined = options.cors ?? {
    origin: options.corsOrigin ?? DEFAULT_CORS_ORIGIN,
  };

  const server = await createTransportServer({
    host: options.host ?? DEFAULT_HOST,
    port: options.port ?? DEFAULT_PORT,
    cors,
    onIntent(intent) {
      return pipeline.handle(intent);
    },
  });

  publisher = server.publishTelemetry;

  while (pendingTelemetry.length > 0) {
    const event = pendingTelemetry.shift();

    if (event) {
      publisher(event);
    }
  }

  return {
    server,
    pipeline,
    context,
    async stop() {
      await server.close();
    },
  } satisfies FacadeDevServerInstance;
}

function ensureError(candidate: unknown): Error {
  return candidate instanceof Error ? candidate : new Error(String(candidate));
}

async function main(): Promise<void> {
  const envPort = Number.parseInt(process.env.FACADE_TRANSPORT_PORT ?? String(DEFAULT_PORT), 10);

  if (!Number.isInteger(envPort) || envPort <= 0) {
    throw new Error('FACADE_TRANSPORT_PORT must be a positive integer.');
  }

  const instance = await startFacadeDevServer({
    host: process.env.FACADE_TRANSPORT_HOST ?? DEFAULT_HOST,
    port: envPort,
    corsOrigin: process.env.FACADE_TRANSPORT_CORS_ORIGIN ?? DEFAULT_CORS_ORIGIN,
  });

  const { server } = instance;

  console.info('Facade transport server listening on %s', server.url);
  console.info('Health endpoint available at %s/healthz', server.url);

  const initiateShutdown = () => {
    console.info('\nShutting down transport server...');

    void (async () => {
      try {
        await instance.stop();
        process.exit(0);
      } catch (error) {
        const normalisedError = ensureError(error);
        console.error('Failed to close transport server:', normalisedError);
        process.exit(1);
      }
    })();
  };

  process.once('SIGINT', initiateShutdown);
  process.once('SIGTERM', initiateShutdown);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    const normalisedError = ensureError(error);
    console.error('Failed to start transport server:', normalisedError);
    process.exit(1);
  });
}


