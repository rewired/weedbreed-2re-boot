import type { StrainBlueprint } from '../domain/blueprints/strainBlueprint.ts';
import type { Uuid } from '../domain/entities.ts';

/** One validated F1 candidate retained as part of an immutable breeding run. */
export interface F1Candidate {
  readonly id: Uuid;
  readonly ordinal: number;
  readonly blueprint: StrainBlueprint;
}

/** Persistent record of one deliberate seed-parent × pollen-parent cross. */
export interface BreedingRun {
  readonly id: Uuid;
  readonly intentId: Uuid;
  readonly generation: 'F1';
  readonly laboratoryRoomId: Uuid;
  readonly status: 'candidates-generated' | 'selected';
  readonly seedParentId: Uuid;
  readonly pollenParentId: Uuid;
  readonly qualifyingLotIds: readonly [seedParentLotId: Uuid, pollenParentLotId: Uuid];
  readonly populationSize: 3 | 4 | 5;
  readonly candidates: readonly F1Candidate[];
  readonly selectedCandidateId?: Uuid;
  readonly selectionIntentId?: Uuid;
  readonly createdAtSimTimeHours: number;
}

/** Durable evidence that a strain produced viable harvested parent material. */
export interface QualifiedBreedingParent {
  readonly strainId: Uuid;
  readonly lotId: Uuid;
  readonly harvestIntentId: Uuid;
  readonly quality01: number;
  readonly qualifiedAtSimTimeHours: number;
}

/** Save-safe breeding state; custom strains live in-world and never alter `/data`. */
export interface BreedingState {
  readonly runs: readonly BreedingRun[];
  readonly customStrainRegistry: readonly StrainBlueprint[];
  readonly qualifiedParents: readonly QualifiedBreedingParent[];
}

/** Pure input for deterministic F1 population generation. */
export interface CrossF1Input {
  readonly worldSeed: string;
  readonly runId: Uuid;
  readonly seedParent: StrainBlueprint;
  readonly pollenParent: StrainBlueprint;
  readonly populationSize: 3 | 4 | 5;
}
