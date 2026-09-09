/** Authoritative formula inputs and result for the journey's default 50% partial sale. */
export interface InventorySalePreviewReadModel {
  readonly fraction01: number;
  readonly soldFreshWeightKg: number;
  readonly soldDryWeightKg: number;
  readonly priceCcPerDryGram: number;
  readonly qualityFactor: number;
  readonly proceedsCc: number;
  readonly balanceBeforeCc: number;
  readonly balanceAfterCc: number;
  readonly cycleContributionMarginAfterCc: number;
}

/** Player-facing harvest lot with weight, quality, strain, and durable origin. */
export interface InventoryLotReadModel {
  readonly lotId: string;
  readonly strainId: string;
  readonly strainName: string;
  readonly quality01: number;
  readonly freshWeightKg: number;
  readonly remainingFreshWeightKg: number;
  readonly remainingDryWeightKg: number;
  readonly moisture01: number;
  readonly structureId: string;
  readonly storageRoomId: string;
  readonly source: {
    readonly plantId: string;
    readonly zoneId: string;
    readonly harvestIntentId: string;
  };
  readonly createdAtTick: number;
  readonly salePreview: InventorySalePreviewReadModel | null;
}

/** Complete current harvest inventory projected from storage rooms. */
export interface InventoryReadModel {
  readonly lots: readonly InventoryLotReadModel[];
  readonly totalFreshWeightKg: number;
}
