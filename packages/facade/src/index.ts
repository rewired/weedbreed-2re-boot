import {
  createEngineBootstrapConfig,
  parseCompanyWorld,
  type EngineBootstrapConfig,
  type ParsedCompanyWorld
} from '@wb/engine';

export type { ParsedCompanyWorld } from '@wb/engine';
export { parseCompanyWorld } from '@wb/engine';
export { mapDeviceToView, type DeviceView } from './readModels/deviceView.js';

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
