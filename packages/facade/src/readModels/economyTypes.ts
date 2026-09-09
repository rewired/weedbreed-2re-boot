/** One structure's resolved utility tariffs. */
export interface EconomyTariffReference {
  readonly structureId: string;
  readonly price_electricity: number;
  readonly price_water: number;
}

/** Current tariff rollup plus per-structure references. */
export interface EconomyTariffsSnapshot {
  readonly price_electricity: number;
  readonly price_water: number;
  readonly structures: readonly EconomyTariffReference[];
}

/** Immutable player-facing projection of one authoritative ledger posting. */
export interface EconomyLedgerEntryReadModel {
  readonly id: string;
  readonly intentId?: string;
  readonly category: 'capital_expenditure' | 'operating_expense' | 'seed' | 'sale';
  readonly direction: 'debit' | 'credit';
  readonly amountCc: number;
  readonly balanceAfterCc: number;
  readonly occurredAtSimTimeHours: number;
  readonly referenceId: string;
  readonly description: string;
  readonly metadata?: Readonly<Record<string, string | number>>;
}

/** Player-facing monetary state and current operating-rate projection. */
export interface EconomyReadModel {
  readonly balanceCc: number | null;
  readonly startingBalanceCc: number | null;
  /** Sales minus all costs booked in the current world cycle. */
  readonly cycleContributionMarginCc: number | null;
  readonly ledger: readonly EconomyLedgerEntryReadModel[];
  readonly balance_per_h: number;
  readonly delta_per_h: number;
  readonly dailyDelta_per_h: number;
  readonly operatingCost_per_h: number;
  readonly labourCost_per_h: number;
  readonly maintenanceCost_per_h: number;
  readonly utilitiesCost_per_h: number;
  readonly energy_kwh_per_h: number;
  readonly water_m3_per_h: number;
  readonly energyCost_per_h: number;
  readonly waterCost_per_h: number;
  readonly tariffs: EconomyTariffsSnapshot;
}
