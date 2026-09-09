import { resolveStrain } from '../domain/blueprints/strainResolver.ts';
import type { HarvestLot } from '../domain/types/HarvestLot.ts';
import type { SimulationWorld, Uuid } from '../domain/entities.ts';
import { deterministicUuid } from '../util/uuid.ts';
import { crossF1 } from './crossF1.ts';
import { breedingStateSchema, createBreedingState } from './schema.ts';
import type { BreedingRun } from './types.ts';

/** Minimum quality required for harvested material to qualify as breeding evidence. */
export const BREEDING_PARENT_MIN_QUALITY01 = 0.5;

/** Authoritative input for creating one F1 candidate population. */
export interface StartF1BreedingRunInput {
  readonly intentId: Uuid;
  readonly laboratoryRoomId: Uuid;
  readonly seedParentId: Uuid;
  readonly pollenParentId: Uuid;
  readonly populationSize: 3 | 4 | 5;
}

export type StartF1BreedingRunErrorCode = 'same-parent' | 'parent-not-found' | 'parent-not-qualified' | 'invalid-population-size' | 'invalid-laboratory' | 'intent-conflict';
export type StartF1BreedingRunResult =
  | { readonly ok: true; readonly world: SimulationWorld; readonly run: BreedingRun; readonly replayed: boolean }
  | { readonly ok: false; readonly world: SimulationWorld; readonly code: StartF1BreedingRunErrorCode; readonly message: string };

function collectLots(world: SimulationWorld): readonly HarvestLot[] {
  return world.company.structures.flatMap((structure) => structure.rooms.flatMap((room) => room.inventory?.lots ?? []));
}

/** Chooses the oldest stable qualifying inventory lot for a strain. */
export function findQualifiedBreedingParentLot(world: SimulationWorld, strainId: Uuid): HarvestLot | null {
  return [...collectLots(world)]
    .filter((lot) => lot.strainId === strainId && lot.freshWeight_kg > 0 && lot.quality01 >= BREEDING_PARENT_MIN_QUALITY01)
    .sort((a, b) => a.createdAt_tick - b.createdAt_tick || a.id.localeCompare(b.id))[0] ?? null;
}

/** True when current inventory or durable harvest evidence qualifies the strain. */
export function isQualifiedBreedingParent(world: SimulationWorld, strainId: Uuid): boolean {
  return world.breeding?.qualifiedParents.some((evidence) => evidence.strainId === strainId) === true
    || findQualifiedBreedingParentLot(world, strainId) !== null;
}

function reject(world: SimulationWorld, code: StartF1BreedingRunErrorCode, message: string): StartF1BreedingRunResult {
  return { ok: false, world, code, message };
}

/** Validates parent provenance and appends a replay-safe deterministic F1 run. */
export function startF1BreedingRun(world: SimulationWorld, input: StartF1BreedingRunInput): StartF1BreedingRunResult {
  const breeding = breedingStateSchema.parse(world.breeding ?? createBreedingState());
  if (breeding.runs.some((run) => run.selectionIntentId === input.intentId)) {
    return reject(world, 'intent-conflict', 'Intent id was already used for a candidate selection.');
  }
  const runId = deterministicUuid(world.seed, `breeding:f1:${input.intentId}`);
  const existing = breeding.runs.find((run) => run.id === runId);
  if (existing) {
    const matches = existing.intentId === input.intentId && existing.laboratoryRoomId === input.laboratoryRoomId && existing.seedParentId === input.seedParentId
      && existing.pollenParentId === input.pollenParentId && existing.populationSize === input.populationSize;
    return matches ? { ok: true, world, run: existing, replayed: true }
      : reject(world, 'intent-conflict', 'Breeding intent was already used with different parameters.');
  }
  if (input.seedParentId === input.pollenParentId) return reject(world, 'same-parent', 'Seed and pollen parent must be different strains.');
  if (![3, 4, 5].includes(input.populationSize)) return reject(world, 'invalid-population-size', 'F1 population size must be 3, 4, or 5.');
  const matchingLaboratories = world.company.structures.flatMap((structure) => structure.rooms)
    .filter((room) => room.id === input.laboratoryRoomId && room.purpose === 'laboratory');
  if (matchingLaboratories.length !== 1) return reject(world, 'invalid-laboratory', 'F1 crossing requires exactly one matching laboratory room.');
  const seedParent = resolveStrain(world, input.seedParentId)?.blueprint;
  const pollenParent = resolveStrain(world, input.pollenParentId)?.blueprint;
  if (!seedParent || !pollenParent) return reject(world, 'parent-not-found', 'Both parent strains must resolve in the current runtime registry.');
  const seedLot = findQualifiedBreedingParentLot(world, input.seedParentId);
  const pollenLot = findQualifiedBreedingParentLot(world, input.pollenParentId);
  const seedEvidence = breeding.qualifiedParents.find((entry) => entry.strainId === input.seedParentId);
  const pollenEvidence = breeding.qualifiedParents.find((entry) => entry.strainId === input.pollenParentId);
  if ((!seedLot && !seedEvidence) || (!pollenLot && !pollenEvidence)) {
    return reject(world, 'parent-not-qualified', 'Both parents require harvest evidence with positive weight and quality of at least 0.5.');
  }
  const candidates = crossF1({ worldSeed: world.seed, runId, seedParent, pollenParent, populationSize: input.populationSize });
  const run: BreedingRun = {
    id: runId, intentId: input.intentId, generation: 'F1', laboratoryRoomId: input.laboratoryRoomId, status: 'candidates-generated',
    seedParentId: input.seedParentId, pollenParentId: input.pollenParentId,
    qualifyingLotIds: [seedLot?.id ?? seedEvidence!.lotId, pollenLot?.id ?? pollenEvidence!.lotId],
    populationSize: input.populationSize, candidates, createdAtSimTimeHours: world.simTimeHours,
  };
  const nextBreeding = breedingStateSchema.parse({ ...breeding, runs: [...breeding.runs, run] });
  const nextWorld = { ...world, breeding: nextBreeding } satisfies SimulationWorld;
  return { ok: true, world: nextWorld, run: nextBreeding.runs.at(-1)!, replayed: false };
}
