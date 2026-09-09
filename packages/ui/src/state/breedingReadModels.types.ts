/** One consistently projected trait set used for parents and F1 candidates. */
export interface BreedingTraitsReadModel {
  readonly yieldPotentialGPerPlant: number;
  readonly cycleDurationDays: number;
  readonly resilience01: number;
  readonly thc01: number;
  readonly cbd01: number;
  readonly temperatureBandC: {
    readonly min: number;
    readonly max: number;
  };
}

export interface QualifiedBreedingParentReadModel {
  readonly strainId: string;
  readonly name: string;
  readonly traits: BreedingTraitsReadModel;
}

export interface BreedingRunParentReadModel extends QualifiedBreedingParentReadModel {
  readonly role: "seed" | "pollen";
}

export interface BreedingCandidateReadModel {
  readonly candidateId: string;
  readonly ordinal: number;
  readonly name: string;
  readonly traits: BreedingTraitsReadModel;
  readonly deltaFromParentMean: BreedingTraitsReadModel;
}

export interface BreedingRunReadModel {
  readonly runId: string;
  readonly status: "candidates-generated" | "selected";
  readonly laboratoryRoomId: string;
  readonly populationSize: 3 | 4 | 5;
  readonly parents: readonly BreedingRunParentReadModel[];
  readonly candidates: readonly BreedingCandidateReadModel[];
  readonly selectedCandidateId: string | null;
  readonly customStrain: {
    readonly strainId: string;
    readonly name: string;
    readonly slug: string;
  } | null;
}

export interface BreedingReadModel {
  readonly laboratory: {
    readonly roomId: string;
    readonly roomName: string;
  } | null;
  readonly qualifiedParents: readonly QualifiedBreedingParentReadModel[];
  readonly crossEligibility: {
    readonly eligible: boolean;
    readonly reasons: readonly ("laboratory-required" | "two-qualified-parents-required")[];
  };
  readonly runs: readonly BreedingRunReadModel[];
}
