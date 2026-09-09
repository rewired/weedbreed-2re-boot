/* eslint-disable wb-sim/no-ts-import-js-extension */

import type { BreedingReadModel } from './breeding/types.js';
import type { EconomyReadModel } from './economyTypes.js';
import type { InventoryReadModel } from './inventoryTypes.js';
import type { RunSummaryReadModel } from './runSummary/types.js';
import type {
  CompatibilityMaps,
  HrReadModel,
  PriceBookCatalog,
  SimulationReadModel,
  StructureReadModel,
} from './types.js';

/** Complete player-facing projection composed after an authoritative world commit. */
export interface ReadModelSnapshot {
  readonly simulation: SimulationReadModel;
  readonly economy: EconomyReadModel;
  readonly structures: readonly StructureReadModel[];
  readonly hr: HrReadModel;
  readonly priceBook: PriceBookCatalog;
  readonly compatibility: CompatibilityMaps;
  readonly inventory: InventoryReadModel;
  readonly breeding: BreedingReadModel;
  readonly runSummary: RunSummaryReadModel;
}

export type FrozenReadModelSnapshot = ReadModelSnapshot;
