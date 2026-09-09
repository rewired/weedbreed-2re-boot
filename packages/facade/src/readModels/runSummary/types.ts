export type RunSummaryStatus = 'locked' | 'in-progress' | 'completed';
export type RunSummaryRole = 'seed-parent' | 'pollen-parent' | 'selected-f1';

export interface RunSummaryActualMetrics {
  readonly harvestedPlantCount: number;
  readonly harvestedFreshWeightG: number;
  readonly averageQuality01: number;
  readonly averageCycleDurationHours: number;
  /** Realized strain-attributable sales less seed debits; shared operating costs are excluded. */
  readonly realizedDirectMarginCc: number;
  readonly saleStatus: 'not-sold' | 'partially-sold' | 'sold';
}

export interface RunSummaryBlueprintPotential {
  readonly yieldPotentialGPerPlant: number;
  readonly cycleDurationDays: number;
  readonly resilience01: number;
}

export interface RunSummaryEntry {
  readonly role: RunSummaryRole;
  readonly strainId: string;
  readonly name: string;
  readonly actual: RunSummaryActualMetrics | null;
  readonly blueprintPotential: RunSummaryBlueprintPotential;
}

export interface RunSummaryReadModel {
  readonly status: RunSummaryStatus;
  readonly completed: boolean;
  readonly completedAtSimTimeHours: number | null;
  readonly breedingRunId: string | null;
  /** Shared tick operating expenses intentionally not allocated to a strain. */
  readonly unallocatedOperatingExpenseCc: number;
  /** Existing authoritative whole-world ledger margin, including CapEx and shared OpEx. */
  readonly overallCycleContributionMarginCc: number | null;
  readonly entries: readonly RunSummaryEntry[];
}
