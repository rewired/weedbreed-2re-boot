/* eslint-disable wb-sim/no-ts-import-js-extension */

import {
  createEngineBootstrapConfig,
  parseCompanyWorld,
  type EngineBootstrapConfig,
  type ParsedCompanyWorld
} from '@wb/engine';

export type { ParsedCompanyWorld } from '@wb/engine';
export { parseCompanyWorld } from '@wb/engine';
export { mapDeviceToView, type DeviceView } from './readModels/deviceView.js';
export {
  createWorkforceView,
  type WorkforceDirectoryFilters,
  type WorkforceDirectoryGender,
  type WorkforceEmployeeDetailView,
  type WorkforceEmployeeTraitView,
  type WorkforceEmployeeSkillView,
  type WorkforceEmployeeSummary,
  type WorkforceFilterOption,
  type WorkforceKpiView,
  type WorkforceQueueTaskView,
  type WorkforceView,
  type WorkforceViewOptions,
  type WorkforceWarningView
} from './readModels/workforceView.js';
export {
  createTraitBreakdown,
  type TraitBreakdownEntry,
  type TraitBreakdownTotals,
  type TraitBreakdownView,
} from './readModels/traitBreakdownView.js';
export {
  createHiringMarketView,
  type HiringMarketCandidateSkillView,
  type HiringMarketCandidateTraitView,
  type HiringMarketCandidateView,
  type HiringMarketConfigView,
  type HiringMarketStructureView,
  type HiringMarketView,
  type HiringMarketViewOptions,
} from './readModels/hiringMarketView.js';
export {
  fetchCompanyTree,
  fetchStructureTariffs,
  fetchWorkforceView,
  ReadModelClientError,
} from './readModels/client.js';
export {
  composeReadModelSnapshot,
  validateReadModelSnapshot,
  type CompatibilityMaps,
  type EconomyLedgerEntryReadModel,
  type EconomyReadModel,
  type HarvestEligibilityReadModel,
  type HrReadModel,
  type InventoryLotReadModel,
  type InventoryReadModel,
  type InventorySalePreviewReadModel,
  type PriceBookCatalog,
  type ReadModelSnapshot,
  type SimulationReadModel,
  type StructureReadModel,
  type TimelineEntry,
  type ZoneReadModel,
} from './readModels/snapshot.js';
export {
  createHiringMarketHireIntent,
  createHiringMarketScanIntent,
} from './intents/hiring.js';
export {
  createGameNewIntent,
  DEFAULT_DEMO_SEED,
  gameNewIntentSchema,
  type GameNewIntent,
} from './intents/game.js';
export {
  devicePurchaseInstallIntentSchema,
  roomCreateIntentSchema,
  zoneCreateIntentSchema,
  type DevicePurchaseInstallIntent,
  type RoomCreateIntent,
  type ZoneCreateIntent,
} from './intents/facility/index.js';
export {
  plantsHarvestIntentSchema,
  plantsSowIntentSchema,
  type PlantsHarvestIntent,
  type PlantsSowIntent,
} from './intents/plants/index.js';
export {
  inventorySellIntentSchema,
  type InventorySellIntent,
} from './intents/inventory/index.js';
export {
  JOURNEY_MILESTONE_CODES,
  SESSION_SCHEMA_VERSION,
  journeyProgressSchema,
  sessionEnvelopeSchema,
  sessionLoadIntentSchema,
  sessionPlaybackSchema,
  sessionSaveIntentSchema,
  type JourneyMilestoneCode,
  type JourneyProgress,
  type SessionEnvelope,
  type SessionLoadIntent,
  type SessionPlayback,
  type SessionSaveIntent,
} from './intents/session/index.js';
export {
  breedingCrossF1IntentSchema,
  breedingSelectCandidateIntentSchema,
  type BreedingCrossF1Intent,
  type BreedingSelectCandidateIntent,
} from './intents/breeding/index.js';
export type {
  BreedingReadModel,
  BreedingRunReadModel,
  BreedingTraitDeltaReadModel,
  BreedingTraitsReadModel,
} from './readModels/breeding/index.js';
export type {
  RunSummaryActualMetrics,
  RunSummaryBlueprintPotential,
  RunSummaryEntry,
  RunSummaryReadModel,
  RunSummaryRole,
  RunSummaryStatus,
} from './readModels/runSummary/index.js';
export {
  createTransportServer,
  MAX_SESSION_ENVELOPE_BYTES,
  type TransportCorsOptions,
  type TransportServer,
  type TransportServerOptions,
} from './transport/server.js';
export {
  createReadModelHttpServer,
  type ReadModelHttpLogger,
  type ReadModelHttpServer,
  type ReadModelHttpServerOptions,
  type ReadModelProviders,
} from './server/http.js';

/**
 * Parameters required to initialise the façade layer that brokers between the engine and clients.
 */
export interface FacadeInitOptions {
  /**
   * Identifier of the scenario that should be proxied by the façade.
   */
  readonly scenarioId: string;

  /**
   * When true, the façade mirrors verbose diagnostics emitted by the engine.
   */
  readonly verbose?: boolean;

  /**
   * Company-centric world tree that should be validated before the engine boots.
   */
  readonly world: unknown;
}

/**
 * High-level response returned after the façade initialisation completes.
 */
export interface FacadeInitResult {
  /**
   * The deterministic engine bootstrap configuration derived from façade inputs.
   */
  readonly engineConfig: EngineBootstrapConfig;

  /**
   * Strongly typed company world tree validated against SEC invariants.
   */
  readonly companyWorld: ParsedCompanyWorld;
}

/**
 * Derives a deterministic façade boot sequence while enforcing shared configuration contracts.
 *
 * @param options - User-provided façade options.
 * @returns {@link FacadeInitResult} referencing the engine bootstrap configuration.
 */
export function initializeFacade(options: FacadeInitOptions): FacadeInitResult {
  const companyWorld = parseCompanyWorld(options.world);
  const engineConfig = createEngineBootstrapConfig(options.scenarioId, options.verbose ?? false);

  return { engineConfig, companyWorld } satisfies FacadeInitResult;
}
