/* eslint-disable wb-sim/no-ts-import-js-extension */

import { uuidSchema, type SaveGame } from '@wb/engine';
import { z } from 'zod';
import { journeyProgressSchema } from './journeyProgress.js';

export const SESSION_SCHEMA_VERSION = 1 as const;

export const sessionPlaybackSchema = z.object({
  status: z.enum(['paused', 'running']),
  speedMultiplier: z.number().finite().positive(),
}).strict();

export const sessionEnvelopeSchema = z.object({
  sessionSchemaVersion: z.literal(SESSION_SCHEMA_VERSION),
  engineSave: z.unknown() as z.ZodType<SaveGame>,
  worldHash: z.string().regex(/^[0-9a-f]{64}$/),
  playback: sessionPlaybackSchema,
  journeyProgress: journeyProgressSchema,
}).strict();

const metadataSchema = z.object({
  intentId: uuidSchema,
  correlationId: z.string().trim().min(1).optional(),
});

export const sessionSaveIntentSchema = metadataSchema.extend({
  type: z.literal('session.save.v1'),
}).strict();

export const sessionLoadIntentSchema = metadataSchema.extend({
  type: z.literal('session.load.v1'),
  session: sessionEnvelopeSchema,
}).strict();

export type SessionEnvelope = z.infer<typeof sessionEnvelopeSchema>;
export type SessionPlayback = z.infer<typeof sessionPlaybackSchema>;
export type SessionSaveIntent = z.infer<typeof sessionSaveIntentSchema>;
export type SessionLoadIntent = z.infer<typeof sessionLoadIntentSchema>;
