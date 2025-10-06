import { z } from 'zod';

import { CURRENT_SAVE_SCHEMA_VERSION } from './constants.js';

/**
 * Base schema that only asserts the presence and type of `schemaVersion`.
 */
export const saveGameEnvelopeSchema = z.object({
  schemaVersion: z.number().int().nonnegative(),
});

/**
 * Schema describing legacy save files (schemaVersion 0).
 */
export const legacySaveGameSchemaV0 = z
  .object({
    schemaVersion: z.literal(0),
    seed: z.string().min(1, 'seed must be a non-empty string'),
    ticksElapsed: z.number().int().nonnegative(),
    hoursElapsed: z.number().nonnegative(),
    world: z.unknown(),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

const saveGameMetadataSchema = z
  .object({
    createdAtIso: z.string().datetime(),
    description: z.string().min(1).optional(),
  })
  .strict();

const simTimeSchema = z
  .object({
    tick: z.number().int().nonnegative(),
    hoursElapsed: z.number().nonnegative(),
  })
  .strict();

/**
 * Canonical schema describing save files for the current version.
 */
export const saveGameSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SAVE_SCHEMA_VERSION),
    seed: z.string().min(1, 'seed must be a non-empty string'),
    simTime: simTimeSchema,
    world: z.unknown(),
    metadata: saveGameMetadataSchema.optional(),
  })
  .strict();

export type LegacySaveGameV0 = z.infer<typeof legacySaveGameSchemaV0>;
export type SaveGame = z.infer<typeof saveGameSchema>;
