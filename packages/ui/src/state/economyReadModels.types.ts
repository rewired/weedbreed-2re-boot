import type { EconomyTariffsSnapshot } from "@ui/state/readModels.types";

/** Immutable player-facing projection of one authoritative ledger posting. */
export interface EconomyLedgerEntryReadModel {
  readonly id: string;
  readonly intentId?: string;
  readonly category: "capital_expenditure" | "operating_expense" | "seed" | "sale";
  readonly direction: "debit" | "credit";
  readonly amountCc: number;
  readonly balanceAfterCc: number;
  readonly occurredAtSimTimeHours: number;
  readonly referenceId: string;
  readonly description: string;
  readonly metadata?: Readonly<Record<string, string | number>>;
}

/** Authoritative company economy plus legacy rate projections. */
export interface EconomyReadModel {
  readonly balanceCc: number | null;
  readonly startingBalanceCc: number | null;
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
