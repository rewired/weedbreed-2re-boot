/* eslint-disable wb-sim/no-ts-import-js-extension */

import { createDemoScenario, type SimulationWorld } from '@wb/engine';
import { gameNewIntentSchema, type GameNewIntent } from '../intents/game.js';
import type { TransportAck, TransportIntentEnvelope } from './adapter.js';

/** Successful acknowledgement emitted only after the replacement world is authoritative. */
export interface GameNewAck extends TransportAck {
  readonly ok: true;
  readonly status: 'applied';
  readonly appliedTick: 0;
  readonly result: {
    readonly command: 'game.new';
    readonly companyId: string;
    readonly seed: string;
  };
  readonly stateAfter: {
    readonly simTimeHours: 0;
    readonly paused: true;
  };
}

/** Dependencies used to execute a new-game command atomically. */
export interface GameCommandHandlerOptions {
  readonly setWorld: (world: SimulationWorld) => void;
  readonly createScenario?: (input: Pick<GameNewIntent, 'companyName' | 'seed'>) => SimulationWorld;
  readonly beforeWorldReplace?: (world: SimulationWorld) => void | Promise<void>;
}

/** Stateful, idempotent handler for the canonical new-game intent. */
export interface GameCommandHandler {
  handle(envelope: TransportIntentEnvelope): Promise<GameNewAck>;
}

interface CachedSubmission {
  readonly fingerprint: string;
  readonly result: Promise<GameNewAck>;
}

function fingerprint(intent: GameNewIntent): string {
  return JSON.stringify({ companyName: intent.companyName, seed: intent.seed });
}

function createAck(world: SimulationWorld): GameNewAck {
  return {
    ok: true,
    status: 'applied',
    appliedTick: 0,
    result: {
      command: 'game.new',
      companyId: world.company.id,
      seed: world.seed,
    },
    stateAfter: {
      simTimeHours: 0,
      paused: true,
    },
  } satisfies GameNewAck;
}

/** Creates an executor that replaces the world once and replays its acknowledgement by intent id. */
export function createGameCommandHandler(options: GameCommandHandlerOptions): GameCommandHandler {
  const createScenario = options.createScenario ?? createDemoScenario;
  const submissions = new Map<string, CachedSubmission>();

  return {
    async handle(envelope: TransportIntentEnvelope): Promise<GameNewAck> {
      const intent = gameNewIntentSchema.parse(envelope);
      const intentFingerprint = fingerprint(intent);
      const cached = submissions.get(intent.intentId);

      if (cached) {
        if (cached.fingerprint !== intentFingerprint) {
          throw new Error(`Intent id ${intent.intentId} was already used with a different payload.`);
        }

        return cached.result;
      }

      const execution = (async (): Promise<GameNewAck> => {
        const world = createScenario({ companyName: intent.companyName, seed: intent.seed });

        if (world.simTimeHours !== 0) {
          throw new Error('Demo scenario builder must return a world at simTimeHours 0.');
        }

        await options.beforeWorldReplace?.(world);
        options.setWorld(world);
        return createAck(world);
      })();

      submissions.set(intent.intentId, { fingerprint: intentFingerprint, result: execution });

      try {
        return await execution;
      } catch (error: unknown) {
        submissions.delete(intent.intentId);
        throw error;
      }
    },
  } satisfies GameCommandHandler;
}
