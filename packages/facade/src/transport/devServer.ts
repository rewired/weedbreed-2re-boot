import process from 'node:process';
import { pathToFileURL } from 'node:url';
/* eslint-disable wb-sim/no-ts-import-js-extension */

import { z } from 'zod';

import { type EngineRunContext } from '@/backend/src/engine/Engine.js';
import { createDeterministicWorld } from '../backend/deterministicWorldLoader.js';

import {
  createEngineCommandPipeline,
  type EngineCommandPipeline,
} from './engineCommandPipeline.js';
import {
  createPlaybackController,
  type PlaybackController,
  type PlaybackControllerState,
} from './playbackController.js';
import {
  createTransportServer,
  type TransportCorsOptions,
  type TransportServer,
} from './server.js';
import type { TransportAck, TransportIntentEnvelope } from './adapter.js';
import { shouldAutoPauseForIncident } from './incidentTelemetry.js';
import {
  createJourneyProgress,
  createSessionIntentHandler,
  reconcileJourneyProgress,
  type JourneyProgress,
} from '../intents/session/index.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 7101;
const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';

type TelemetryEnvelope = Parameters<TransportServer['publishTelemetry']>[0];

export interface StartFacadeDevServerOptions {
  readonly host?: string;
  readonly port?: number;
  readonly cors?: TransportCorsOptions;
  readonly corsOrigin?: string;
  readonly world?: ReturnType<typeof createDeterministicWorld>['world'];
  readonly context?: EngineRunContext;
}

export interface FacadeDevServerInstance {
  readonly server: TransportServer;
  readonly pipeline: EngineCommandPipeline;
  readonly context: EngineRunContext;
  readonly playback: PlaybackController;
  stop(): Promise<void>;
}

interface SimulationControlStateSnapshot {
  readonly running: boolean;
  readonly paused: boolean;
  readonly speedMultiplier: number;
}

type SimulationControlAck = TransportAck & {
  readonly stateAfter: SimulationControlStateSnapshot;
};

export interface SimulationControlIntentHandlerOptions {
  readonly playback: PlaybackController;
  readonly parseSpeedMultiplier: (intent: TransportIntentEnvelope) => number;
}

function toSimulationControlAck(state: PlaybackControllerState): SimulationControlAck {
  return {
    ok: true,
    status: 'applied',
    stateAfter: {
      running: state.isPlaying,
      paused: !state.isPlaying,
      speedMultiplier: state.speedMultiplier,
    },
  } satisfies SimulationControlAck;
}

export function createSimulationControlIntentHandler(
  options: SimulationControlIntentHandlerOptions
): (intent: TransportIntentEnvelope) => TransportAck | undefined {
  const { playback, parseSpeedMultiplier } = options;

  return (intent: TransportIntentEnvelope): TransportAck | undefined => {
    switch (intent.type) {
      case 'simulation.control.play': {
        playback.play();
        return toSimulationControlAck(playback.getState());
      }
      case 'simulation.control.pause': {
        playback.pause();
        return toSimulationControlAck(playback.getState());
      }
      case 'simulation.control.step': {
        playback.step();
        return toSimulationControlAck(playback.getState());
      }
      case 'simulation.control.speed': {
        const multiplier = parseSpeedMultiplier(intent);
        playback.setSpeed(multiplier);
        return toSimulationControlAck(playback.getState());
      }
      default:
        return undefined;
    }
  };
}

export async function startFacadeDevServer(
  options: StartFacadeDevServerOptions = {}
): Promise<FacadeDevServerInstance> {
  const seeded = createDeterministicWorld();
  let world = options.world ?? seeded.world;
  const baseContext: EngineRunContext = options.context ?? {};
  const upstreamTelemetry = baseContext.telemetry;
  const debugTelemetryBuffer = process.env.WB_FACADE_DEBUG_TELEMETRY === 'true';
  const pendingTelemetry: TelemetryEnvelope[] = [];
  let publisher: TransportServer['publishTelemetry'] | null = null;
  let resetTelemetrySequence: (() => void) | null = null;
  let telemetryNamespace: TransportServer['namespaces']['telemetry'] | null = null;
  const playbackHolder: { current?: PlaybackController } = {};
  let journeyProgress: JourneyProgress = createJourneyProgress();

  const logTelemetryBuffer = (message: string): void => {
    if (!debugTelemetryBuffer) {
      return;
    }

    const size = pendingTelemetry.length;
    console.debug('[facade][telemetry-buffer]', `${message} (size=${size})`);
  };

  const hasTelemetrySubscribers = (): boolean =>
    (telemetryNamespace?.sockets.size ?? 0) > 0;

  const flushPendingTelemetry = () => {
    if (!publisher) {
      logTelemetryBuffer('skip flush: publisher unavailable');
      return;
    }

    if (!hasTelemetrySubscribers()) {
      logTelemetryBuffer('skip flush: no telemetry subscribers');
      return;
    }

    while (pendingTelemetry.length > 0) {
      const event = pendingTelemetry.shift();

      if (event) {
        publisher(event);
      }
    }

    logTelemetryBuffer('flushed pending telemetry');
  };

  const telemetryBridge: EngineRunContext['telemetry'] = {
    emit(topic, payload) {
      if (shouldAutoPauseForIncident(topic, payload)) {
        playbackHolder.current?.pause();
      }

      const envelope: TelemetryEnvelope = { topic, payload };

      if (publisher && hasTelemetrySubscribers()) {
        publisher(envelope);
      } else {
        pendingTelemetry.push(envelope);
        logTelemetryBuffer('queued telemetry envelope');
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
    beforeWorldReplace() {
      playbackHolder.current?.pause();
      pendingTelemetry.length = 0;
      resetTelemetrySequence?.();
      journeyProgress = createJourneyProgress();
    },
  });

  const playback = createPlaybackController({
    pipeline,
    onTick() {
      journeyProgress = reconcileJourneyProgress(journeyProgress, pipeline.getWorld());
      flushPendingTelemetry();
    },
  });
  playbackHolder.current = playback;

  const speedIntentSchema = z.object({
    multiplier: z.number().finite().positive(),
  });

  const handleSimulationControlIntent = createSimulationControlIntentHandler({
    playback,
    parseSpeedMultiplier(intent) {
      const { multiplier } = speedIntentSchema.parse(intent);
      return multiplier;
    },
  });
  const sessionIntents = createSessionIntentHandler({
    getWorld: pipeline.getWorld,
    getPlayback() {
      const state = playback.getState();
      return { status: state.isPlaying ? 'running' : 'paused', speedMultiplier: state.speedMultiplier };
    },
    getJourneyProgress: () => journeyProgress,
    replace(state) {
      playback.pause();
      pendingTelemetry.length = 0;
      resetTelemetrySequence?.();
      pipeline.replaceWorld(state.world);
      journeyProgress = state.journeyProgress;
      playback.setSpeed(state.playback.speedMultiplier);
      if (state.playback.status === 'running') playback.play();
    },
  });

  const cors: TransportCorsOptions | undefined = options.cors ?? {
    origin: options.corsOrigin ?? DEFAULT_CORS_ORIGIN,
  };

  const server = await createTransportServer({
    host: options.host ?? DEFAULT_HOST,
    port: options.port ?? DEFAULT_PORT,
    cors,
    telemetryIdentity: {
      getSeed: () => pipeline.getWorld().seed,
      getSimTick: () => Math.trunc(pipeline.getWorld().simTimeHours),
    },
    async onIntent(intent) {
      if (intent.type === 'session.save.v1' || intent.type === 'session.load.v1') {
        if (intent.type === 'session.save.v1') {
          journeyProgress = reconcileJourneyProgress(journeyProgress, pipeline.getWorld());
        }
        return sessionIntents(intent);
      }
      const acknowledgement = handleSimulationControlIntent(intent);

      if (acknowledgement) {
        return acknowledgement;
      }

      const response = await pipeline.handle(intent);
      journeyProgress = reconcileJourneyProgress(journeyProgress, pipeline.getWorld());
      return response;
    },
  });

  publisher = server.publishTelemetry;
  resetTelemetrySequence = server.resetTelemetrySequence;
  telemetryNamespace = server.namespaces.telemetry;

  const handleTelemetryConnection = () => {
    logTelemetryBuffer('telemetry namespace connected');
    flushPendingTelemetry();
  };

  telemetryNamespace.on('connection', handleTelemetryConnection);
  flushPendingTelemetry();

  return {
    server,
    pipeline,
    context,
    playback,
    async stop() {
      telemetryNamespace?.off('connection', handleTelemetryConnection);
      playback.dispose();
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
