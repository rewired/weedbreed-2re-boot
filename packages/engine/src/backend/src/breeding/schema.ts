import { z } from 'zod';

import { parseStrainBlueprint } from '../domain/blueprints/strainBlueprint.ts';
import { finiteNumber, uuidSchema } from '../domain/schemas/primitives.ts';
import type { BreedingState } from './types.ts';

const runtimeStrainSchema = z.unknown().transform((value, ctx) => {
  try {
    return parseStrainBlueprint(value);
  } catch (error: unknown) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : 'Invalid runtime strain.',
    });
    return z.NEVER;
  }
});

const candidateSchema = z.object({
  id: uuidSchema,
  ordinal: z.number().int().min(0),
  blueprint: runtimeStrainSchema,
}).strict();

const runSchema = z.object({
  id: uuidSchema,
  intentId: uuidSchema,
  generation: z.literal('F1'),
  laboratoryRoomId: uuidSchema,
  status: z.enum(['candidates-generated', 'selected']),
  seedParentId: uuidSchema,
  pollenParentId: uuidSchema,
  qualifyingLotIds: z.tuple([uuidSchema, uuidSchema]).readonly(),
  populationSize: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  candidates: z.array(candidateSchema).readonly(),
  selectedCandidateId: uuidSchema.optional(),
  selectionIntentId: uuidSchema.optional(),
  createdAtSimTimeHours: finiteNumber.nonnegative(),
}).strict().superRefine((run, ctx) => {
  if (run.seedParentId === run.pollenParentId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pollenParentId'], message: 'Breeding parents must be different.' });
  }
  if (run.candidates.length !== run.populationSize) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['candidates'], message: 'Candidate count must equal populationSize.' });
  }
  if (run.status === 'selected' && !run.selectedCandidateId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['selectedCandidateId'], message: 'Selected runs require selectedCandidateId.' });
  }
  if (run.status === 'selected' && !run.selectionIntentId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['selectionIntentId'], message: 'Selected runs require selectionIntentId.' });
  }
  if (run.status === 'candidates-generated' && (run.selectedCandidateId || run.selectionIntentId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'Unselected runs cannot carry selection fields.' });
  }
  if (run.selectedCandidateId && !run.candidates.some((candidate) => candidate.id === run.selectedCandidateId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['selectedCandidateId'], message: 'Selected candidate must belong to the run.' });
  }
});

/** Runtime and save validation for persistent breeding state. */
export const breedingStateSchema: z.ZodType<BreedingState, z.ZodTypeDef, unknown> = z.object({
  runs: z.array(runSchema).readonly(),
  customStrainRegistry: z.array(runtimeStrainSchema).readonly(),
  qualifiedParents: z.array(z.object({
    strainId: uuidSchema,
    lotId: uuidSchema,
    harvestIntentId: uuidSchema,
    quality01: finiteNumber.min(0).max(1),
    qualifiedAtSimTimeHours: finiteNumber.nonnegative(),
  }).strict()).readonly(),
}).strict().superRefine((state, ctx) => {
  const runIds = new Set<string>();
  const strainIds = new Set<string>();
  const evidenceLotIds = new Set<string>();
  for (const [index, run] of state.runs.entries()) {
    if (runIds.has(run.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['runs', index, 'id'], message: 'Breeding run ids must be unique.' });
    runIds.add(run.id);
  }
  for (const [index, strain] of state.customStrainRegistry.entries()) {
    if (strainIds.has(strain.id) || strainIds.has(strain.slug)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customStrainRegistry', index], message: 'Custom strain ids and slugs must be unique.' });
    strainIds.add(strain.id);
    strainIds.add(strain.slug);
  }
  for (const [index, evidence] of state.qualifiedParents.entries()) {
    if (evidenceLotIds.has(evidence.lotId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['qualifiedParents', index, 'lotId'], message: 'Qualification lot ids must be unique.' });
    evidenceLotIds.add(evidence.lotId);
  }
});

/** Creates an empty canonical breeding registry. */
export function createBreedingState(): BreedingState {
  return breedingStateSchema.parse({ runs: [], customStrainRegistry: [], qualifiedParents: [] });
}
