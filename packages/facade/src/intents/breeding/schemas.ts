/* eslint-disable wb-sim/no-ts-import-js-extension */

import { uuidSchema } from '@wb/engine';
import { z } from 'zod';

const metadataSchema = z.object({
  intentId: uuidSchema,
  correlationId: z.string().trim().min(1).optional(),
});

/** Validated request to generate one role-aware F1 population. */
export const breedingCrossF1IntentSchema = metadataSchema.extend({
  type: z.literal('breeding.crossF1.v1'),
  laboratoryRoomId: uuidSchema,
  seedParentId: uuidSchema,
  pollenParentId: uuidSchema,
  populationSize: z.union([z.literal(3), z.literal(4), z.literal(5)]),
}).strict().refine((value) => value.seedParentId !== value.pollenParentId, {
  message: 'Seed and pollen parent must be different strains.',
  path: ['pollenParentId'],
});

/** Validated request to select, name, and register one generated candidate. */
export const breedingSelectCandidateIntentSchema = metadataSchema.extend({
  type: z.literal('breeding.selectCandidate.v1'),
  runId: uuidSchema,
  candidateId: uuidSchema,
  name: z.string().trim().min(1).max(80),
}).strict();

export type BreedingCrossF1Intent = z.infer<typeof breedingCrossF1IntentSchema>;
export type BreedingSelectCandidateIntent = z.infer<typeof breedingSelectCandidateIntentSchema>;
export type BreedingIntent = BreedingCrossF1Intent | BreedingSelectCandidateIntent;
