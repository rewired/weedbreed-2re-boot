/* eslint-disable wb-sim/no-ts-import-js-extension */
import type { EngineBootstrapConfig, ParsedCompanyWorld, SimulationWorld } from '@wb/engine';
import type { ReadModelProviders } from './http.js';
import { composeReadModelSnapshot, type ReadModelSnapshot } from '../readModels/snapshot.js';
import type { CompanyTreeReadModel, StructureTariffsReadModel, WorkforceViewReadModel } from '../readModels/api/schemas.js';
import { computeStructureMetrics } from './readModelMetrics.js';
import { mapStructure } from './readModelSnapshotMappers.js';
import { mapCompanyTree, mapStructureTariffs } from './readModelCompanyTree.js';
import { mapWorkforceView } from './readModelWorkforce.js';
import { mapCompatibility, mapEconomyReadModel, mapHrReadModel, mapPriceBook, mapSimulationReadModel } from './readModelCatalogMappers.js';
import { mapInventoryReadModel } from './readModelInventory.js';
import { mapBreedingReadModel } from '../readModels/breeding/index.js';
import { mapRunSummaryReadModel } from '../readModels/runSummary/index.js';

interface EngineContext {
  readonly world: SimulationWorld | (() => SimulationWorld);
  readonly companyWorld: ParsedCompanyWorld | (() => ParsedCompanyWorld);
  readonly config: EngineBootstrapConfig;
  readonly playbackState?: () => { readonly isPlaying: boolean; readonly speedMultiplier: number };
}

function resolveValue<T>(value: T | (() => T)): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (!Object.isFrozen(value)) {
      Object.freeze(value);
    }

    if (Array.isArray(value)) {
      for (const element of value) {
        deepFreeze(element);
      }
    } else {
      for (const key of Object.keys(record)) {
        const nested = record[key];
        if (nested && typeof nested === 'object') {
          deepFreeze(nested);
        }
      }
    }
  }

  return value;
}

export function createReadModelProviders(context: EngineContext): ReadModelProviders {
  return {
    async companyTree(): Promise<CompanyTreeReadModel> {
      return mapCompanyTree(resolveValue(context.world), resolveValue(context.companyWorld), context.config);
    },
    async structureTariffs(): Promise<StructureTariffsReadModel> {
      return mapStructureTariffs(resolveValue(context.world), context.config);
    },
    async workforceView(): Promise<WorkforceViewReadModel> {
      return mapWorkforceView(resolveValue(context.world));
    },
    async readModels(): Promise<ReadModelSnapshot> {
      const world = resolveValue(context.world);
      const companyWorld = resolveValue(context.companyWorld);
      const playbackState = context.playbackState?.();
      const simulation = mapSimulationReadModel(world, playbackState
        ? { paused: !playbackState.isPlaying, speedMultiplier: playbackState.speedMultiplier }
        : undefined);
      const rawStructures = world.company.structures;
      const structureMetrics = rawStructures.map((structure) => computeStructureMetrics(structure));
      const structures = rawStructures.map((structure, index) =>
        mapStructure(structure, companyWorld, world.workforce, structureMetrics[index], world)
      );
      const economy = mapEconomyReadModel(
        world,
        structureMetrics,
        world.workforce,
        context.config.tariffs
      );
      const hr = mapHrReadModel(world.workforce);
      const priceBook = mapPriceBook(world);
      const compatibility = mapCompatibility();
      const inventory = mapInventoryReadModel(world);
      const breeding = mapBreedingReadModel(world);
      const runSummary = mapRunSummaryReadModel(world);

      const snapshot = composeReadModelSnapshot({
        simulation,
        economy,
        structures,
        hr,
        priceBook,
        compatibility,
        inventory,
        breeding,
        runSummary
      });

      return deepFreeze(snapshot);
    }
  };
}

export type ReadModelProviderFactory = ReturnType<typeof createReadModelProviders>;
