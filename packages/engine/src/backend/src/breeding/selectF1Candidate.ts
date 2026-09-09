import { loadAllStrainBlueprints } from '../domain/blueprints/strainBlueprintLoader.ts';
import { parseStrainBlueprint } from '../domain/blueprints/strainBlueprint.ts';
import type { SimulationWorld, Uuid } from '../domain/entities.ts';
import { breedingStateSchema, createBreedingState } from './schema.ts';
import type { BreedingRun } from './types.ts';

const MAX_CUSTOM_STRAIN_NAME_LENGTH = 80;

/** Authoritative input for selecting and naming one generated F1 candidate. */
export interface SelectF1CandidateInput {
  readonly intentId: Uuid;
  readonly runId: Uuid;
  readonly candidateId: Uuid;
  readonly name: string;
}

export type SelectF1CandidateErrorCode = 'invalid-name' | 'run-not-found' | 'candidate-not-found' | 'already-selected' | 'intent-conflict' | 'strain-collision';
export type SelectF1CandidateResult =
  | { readonly ok: true; readonly world: SimulationWorld; readonly run: BreedingRun; readonly replayed: boolean }
  | { readonly ok: false; readonly world: SimulationWorld; readonly code: SelectF1CandidateErrorCode; readonly message: string };

function toSlug(name: string): string {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-');
}

function reject(world: SimulationWorld, code: SelectF1CandidateErrorCode, message: string): SelectF1CandidateResult {
  return { ok: false, world, code, message };
}

/** Selects exactly one candidate while retaining the complete candidate history and registering the chosen runtime strain. */
export function selectF1Candidate(world: SimulationWorld, input: SelectF1CandidateInput): SelectF1CandidateResult {
  const breeding = breedingStateSchema.parse(world.breeding ?? createBreedingState());
  const name = input.name.trim();
  const slug = toSlug(name);
  if (name.length === 0 || name.length > MAX_CUSTOM_STRAIN_NAME_LENGTH || slug.length === 0) {
    return reject(world, 'invalid-name', `Custom strain name must contain 1-${String(MAX_CUSTOM_STRAIN_NAME_LENGTH)} usable characters.`);
  }
  if (breeding.runs.some((entry) => entry.intentId === input.intentId)) {
    return reject(world, 'intent-conflict', 'Intent id was already used to create a breeding run.');
  }
  const intentRun = breeding.runs.find((entry) => entry.selectionIntentId === input.intentId);
  if (intentRun) {
    const custom = breeding.customStrainRegistry.find((strain) => strain.id === input.candidateId);
    const matches = intentRun.id === input.runId && intentRun.selectedCandidateId === input.candidateId
      && custom?.name === name && custom.slug === slug;
    return matches ? { ok: true, world, run: intentRun, replayed: true }
      : reject(world, 'intent-conflict', 'Selection intent was already used with different parameters.');
  }
  const runIndex = breeding.runs.findIndex((entry) => entry.id === input.runId);
  if (runIndex < 0) return reject(world, 'run-not-found', 'Breeding run does not exist.');
  const run = breeding.runs[runIndex]!;
  if (run.status === 'selected') return reject(world, 'already-selected', 'This breeding run already has a selected candidate.');
  const candidate = run.candidates.find((entry) => entry.id === input.candidateId);
  if (!candidate) return reject(world, 'candidate-not-found', 'Candidate does not belong to this breeding run.');
  const staticStrains = [...loadAllStrainBlueprints().values()];
  const collision = [...staticStrains, ...breeding.customStrainRegistry]
    .some((strain) => strain.id === candidate.id || strain.slug === slug);
  if (collision) return reject(world, 'strain-collision', 'Custom strain id or slug collides with an existing strain.');
  const customStrain = parseStrainBlueprint({ ...candidate.blueprint, name, slug });
  const selectedRun: BreedingRun = {
    ...run,
    status: 'selected',
    selectedCandidateId: candidate.id,
    selectionIntentId: input.intentId,
  };
  const nextRuns = breeding.runs.map((entry, index) => index === runIndex ? selectedRun : entry);
  const nextBreeding = breedingStateSchema.parse({
    ...breeding,
    runs: nextRuns,
    customStrainRegistry: [...breeding.customStrainRegistry, customStrain],
  });
  return {
    ok: true,
    world: { ...world, breeding: nextBreeding },
    run: nextBreeding.runs[runIndex]!,
    replayed: false,
  };
}
