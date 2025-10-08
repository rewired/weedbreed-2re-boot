import type { Uuid } from '../schemas/primitives.ts';

export interface HarvestLot {
  readonly id: Uuid;
  readonly structureId: Uuid;
  readonly roomId: Uuid;
  readonly source: {
    readonly plantId: Uuid;
    readonly zoneId: Uuid;
  };
  readonly freshWeight_kg: number;
  readonly moisture01: number;
  readonly quality01: number;
  readonly createdAt_tick: number;
}
