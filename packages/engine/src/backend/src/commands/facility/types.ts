import type { SimulationWorld, Uuid } from '../../domain/entities.ts';

export type FacilityCommandErrorCode =
  | 'invalid_command'
  | 'intent_conflict'
  | 'structure_not_found'
  | 'room_not_found'
  | 'zone_not_found'
  | 'insufficient_capacity'
  | 'incompatible_configuration'
  | 'invalid_placement'
  | 'blueprint_not_found'
  | 'price_unavailable'
  | 'economy_unavailable'
  | 'insufficient_funds';

export interface FacilityCommandRejection {
  readonly ok: false;
  readonly world: SimulationWorld;
  readonly code: FacilityCommandErrorCode;
  readonly message: string;
}

export interface FacilityCommandSuccess {
  readonly ok: true;
  readonly world: SimulationWorld;
  readonly entityId: Uuid;
  readonly replayed: boolean;
}

export type FacilityMutationResult = FacilityCommandSuccess | FacilityCommandRejection;

export interface DeferredPurchaseCost {
  readonly amountCc: number;
  readonly booking: 'booked';
  readonly ledgerEntryId: Uuid;
  readonly balanceAfterCc: number;
}

export interface DeviceCoverageResult {
  readonly installedCoverage_m2: number;
  readonly totalBlueprintCoverage_m2: number;
  readonly requiredCoverage_m2: number;
  readonly remainingCoverage_m2: number;
  readonly sufficient: boolean;
}

export interface DevicePurchaseInstallSuccess extends FacilityCommandSuccess {
  readonly purchaseCost: DeferredPurchaseCost;
  readonly coverage: DeviceCoverageResult;
}

export type DevicePurchaseInstallResult =
  | DevicePurchaseInstallSuccess
  | FacilityCommandRejection;
