import type { Uuid } from '../schemas/primitives.ts';

export interface HarvestLot {
  readonly id: Uuid;
  readonly structureId: Uuid;
  readonly roomId: Uuid;
  /** Strain identity retained for pricing, breeding qualification, and lineage. */
  readonly strainId: Uuid;
  readonly source: {
    readonly plantId: Uuid;
    readonly zoneId: Uuid;
    /** Player intent that created this lot; provides durable replay identity. */
    readonly harvestIntentId: Uuid;
  };
  readonly freshWeight_kg: number;
  readonly moisture01: number;
  readonly quality01: number;
  readonly createdAt_tick: number;
}
