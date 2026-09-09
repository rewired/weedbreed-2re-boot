export type RunSummaryStatus = "locked" | "in-progress" | "completed";
export type RunSummaryRole = "seed-parent" | "pollen-parent" | "selected-f1";
export type RunSummarySaleStatus = "not-sold" | "partially-sold" | "sold";

export interface RunSummaryActualReadModel {
  readonly harvestedPlantCount: number;
  readonly harvestedFreshWeightG: number;
  readonly averageQuality01: number;
  readonly averageCycleDurationHours: number;
  /** World-lifetime strain sales minus seed debits; shared OpEx is deliberately excluded. */
  readonly realizedDirectMarginCc: number;
  readonly saleStatus: RunSummarySaleStatus;
}

export interface RunSummaryEntryReadModel {
  readonly role: RunSummaryRole;
  readonly strainId: string;
  readonly name: string;
  readonly actual: RunSummaryActualReadModel | null;
  readonly blueprintPotential: {
    readonly yieldPotentialGPerPlant: number;
    readonly cycleDurationDays: number;
    readonly resilience01: number;
  };
}

export interface RunSummaryReadModel {
  readonly status: RunSummaryStatus;
  readonly completed: boolean;
  readonly completedAtSimTimeHours: number | null;
  readonly breedingRunId: string | null;
  readonly unallocatedOperatingExpenseCc: number;
  readonly overallCycleContributionMarginCc: number | null;
  readonly entries: readonly RunSummaryEntryReadModel[];
}
