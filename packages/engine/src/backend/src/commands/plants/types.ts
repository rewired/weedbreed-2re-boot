import type { SimulationWorld, Uuid } from '../../domain/entities.ts';
import type { HarvestLot } from '../../domain/types/HarvestLot.ts';

/** Stable rejection codes returned by the sow command. */
export type PlantsSowErrorCode =
  | 'invalid_command'
  | 'intent_conflict'
  | 'structure_not_found'
  | 'room_not_found'
  | 'zone_not_found'
  | 'invalid_placement'
  | 'zone_not_ready'
  | 'zone_not_empty'
  | 'strain_not_found'
  | 'incompatible_strain'
  | 'capacity_exceeded'
  | 'price_unavailable'
  | 'economy_unavailable'
  | 'insufficient_funds';

/** Deferred seed cost pending the R-501 company ledger. */
export interface DeferredSeedCost {
  readonly unitPriceCc: number;
  readonly quantity: number;
  readonly amountCc: number;
  readonly booking: 'booked';
  readonly ledgerEntryId: Uuid;
  readonly balanceAfterCc: number;
}

/** Successful immutable sow-command result. */
export interface PlantsSowSuccess {
  readonly ok: true;
  readonly world: SimulationWorld;
  readonly plantIds: readonly Uuid[];
  readonly replayed: boolean;
  readonly seedCost: DeferredSeedCost;
}

/** Rejected sow command; world always retains the original reference. */
export interface PlantsSowRejection {
  readonly ok: false;
  readonly world: SimulationWorld;
  readonly code: PlantsSowErrorCode;
  readonly message: string;
}

/** Result of executing `plants.sow.v1`. */
export type PlantsSowResult = PlantsSowSuccess | PlantsSowRejection;

/** Stable rejection codes returned by the manual harvest command. */
export type PlantsHarvestErrorCode =
  | 'invalid_command'
  | 'intent_conflict'
  | 'structure_not_found'
  | 'room_not_found'
  | 'zone_not_found'
  | 'invalid_placement'
  | 'storage_not_found'
  | 'storage_ambiguous'
  | 'plant_not_found'
  | 'plant_not_active'
  | 'plant_not_ready'
  | 'plant_already_harvested';

/** Successful immutable manual-harvest result. */
export interface PlantsHarvestSuccess {
  readonly ok: true;
  readonly world: SimulationWorld;
  readonly lotIds: readonly Uuid[];
  /** Created lots, or the existing lots on replay, for post-commit telemetry. */
  readonly lots: readonly HarvestLot[];
  readonly replayed: boolean;
}

/** Rejected manual harvest; world always retains the original reference. */
export interface PlantsHarvestRejection {
  readonly ok: false;
  readonly world: SimulationWorld;
  readonly code: PlantsHarvestErrorCode;
  readonly message: string;
}

/** Result of executing `plants.harvest.v1`. */
export type PlantsHarvestResult = PlantsHarvestSuccess | PlantsHarvestRejection;
