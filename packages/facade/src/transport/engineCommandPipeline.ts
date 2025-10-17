import { z } from 'zod';

/* eslint-disable wb-sim/no-ts-import-js-extension */

import { type SimulationWorld, type WorkforceIntent, uuidSchema } from '@wb/engine';
import { runTick, type EngineRunContext } from '@/backend/src/engine/Engine.ts';
import { queueWorkforceIntents } from '@/backend/src/engine/pipeline/applyWorkforce.ts';

import type { TransportIntentEnvelope } from './adapter.js';

/**
 * Runtime contract consumed by {@link createEngineCommandPipeline} to access and mutate the
 * backing simulation world. The façade dev transport server wires this against the demo
 * harness world to keep intent forwarding deterministic.
 */
export interface EngineWorldAccess {
  /** Returns the current simulation world snapshot. */
  readonly get: () => SimulationWorld;
  /** Persists the next simulation world snapshot after processing an intent. */
  readonly set: (world: SimulationWorld) => void;
}

/**
 * Options accepted by {@link createEngineCommandPipeline}.
 */
export interface EngineCommandPipelineOptions {
  /** Read/write accessors for the simulation world handled by the façade. */
  readonly world: EngineWorldAccess;
  /** Optional engine run context shared across ticks. Defaults to an empty context. */
  readonly context?: EngineRunContext;
}

/**
 * Runtime command pipeline that normalises transport intents and forwards them to the engine.
 */
export interface EngineCommandPipeline {
  /** Engine execution context reused across intent submissions. */
  readonly context: EngineRunContext;
  /**
   * Normalises and queues the provided transport intent before advancing the engine pipeline.
   *
   * @throws {Error} When the intent type is unsupported or fails validation.
   */
  handle(intent: TransportIntentEnvelope): Promise<void>;
}

const hiringMarketScanSchema = z.object({
  structureId: uuidSchema,
});

const hiringMarketHireSchema = z.object({
  candidate: z.object({
    structureId: uuidSchema,
    candidateId: uuidSchema,
  }),
});

const workforceRaiseAcceptSchema = z.object({
  employeeId: uuidSchema,
  rateIncreaseFactor: z.number().finite().optional(),
  moraleBoost01: z.number().finite().optional(),
});

const workforceRaiseBonusSchema = z.object({
  employeeId: uuidSchema,
  bonusAmount_cc: z.number().finite().optional(),
  rateIncreaseFactor: z.number().finite().optional(),
  moraleBoost01: z.number().finite().optional(),
});

const workforceRaiseIgnoreSchema = z.object({
  employeeId: uuidSchema,
  moralePenalty01: z.number().finite().optional(),
});

const workforceTerminationSchema = z.object({
  employeeId: uuidSchema,
  reasonSlug: z.string().trim().min(1).optional(),
  severanceCc: z.number().finite().optional(),
  moraleRipple01: z.number().finite().optional(),
});

function toWorkforceIntent(envelope: TransportIntentEnvelope): WorkforceIntent | null {
  switch (envelope.type) {
    case 'hiring.market.scan': {
      const { structureId } = hiringMarketScanSchema.parse(envelope);
      return { type: 'hiring.market.scan', structureId } satisfies WorkforceIntent;
    }

    case 'hiring.market.hire': {
      const { candidate } = hiringMarketHireSchema.parse(envelope);
      return { type: 'hiring.market.hire', candidate } satisfies WorkforceIntent;
    }

    case 'workforce.raise.accept': {
      const { employeeId, rateIncreaseFactor, moraleBoost01 } = workforceRaiseAcceptSchema.parse(envelope);
      return {
        type: 'workforce.raise.accept',
        employeeId,
        rateIncreaseFactor,
        moraleBoost01,
      } satisfies WorkforceIntent;
    }

    case 'workforce.raise.bonus': {
      const {
        employeeId,
        bonusAmount_cc: bonusAmountCc,
        rateIncreaseFactor,
        moraleBoost01,
      } = workforceRaiseBonusSchema.parse(envelope);

      return {
        type: 'workforce.raise.bonus',
        employeeId,
        bonusAmount_cc: bonusAmountCc,
        rateIncreaseFactor,
        moraleBoost01,
      } satisfies WorkforceIntent;
    }

    case 'workforce.raise.ignore': {
      const { employeeId, moralePenalty01 } = workforceRaiseIgnoreSchema.parse(envelope);
      return {
        type: 'workforce.raise.ignore',
        employeeId,
        moralePenalty01,
      } satisfies WorkforceIntent;
    }

    case 'workforce.employee.terminate': {
      const {
        employeeId,
        reasonSlug,
        severanceCc,
        moraleRipple01,
      } = workforceTerminationSchema.parse(envelope);
      return {
        type: 'workforce.employee.terminate',
        employeeId,
        reasonSlug,
        severanceCc,
        moraleRipple01,
      } satisfies WorkforceIntent;
    }

    default:
      return null;
  }
}

function normaliseIntent(envelope: TransportIntentEnvelope): WorkforceIntent {
  try {
    const intent = toWorkforceIntent(envelope);

    if (!intent) {
      throw new Error(`Unsupported intent type: ${envelope.type}`);
    }

    return intent;
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => issue.message).join('; ');
      throw new Error(`Intent payload failed validation: ${issues}`);
    }

    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Creates an engine-backed command pipeline that translates transport intents into engine
 * intents before advancing the simulation by one deterministic tick per submission.
 */
export function createEngineCommandPipeline(
  options: EngineCommandPipelineOptions,
): EngineCommandPipeline {
  const context: EngineRunContext = options.context ?? {};

  return {
    context,
    async handle(envelope: TransportIntentEnvelope): Promise<void> {
      const world = options.world.get();
      const intent = normaliseIntent(envelope);

      queueWorkforceIntents(context, [intent]);
      const { world: nextWorld } = runTick(world, context);
      options.world.set(nextWorld);
    },
  } satisfies EngineCommandPipeline;
}

