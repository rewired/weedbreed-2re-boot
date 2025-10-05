import type { HarvestLot } from './HarvestLot.js';

export interface Inventory {
  readonly lots: readonly HarvestLot[];
}
