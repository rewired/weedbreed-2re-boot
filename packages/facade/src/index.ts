import { createEngineBootstrapConfig } from '@wb/engine';

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
}

/**
 * High-level response returned after the façade initialisation completes.
 */
export interface FacadeInitResult {
  /**
   * The deterministic engine bootstrap configuration derived from façade inputs.
   */
  readonly engineConfig: ReturnType<typeof createEngineBootstrapConfig>;
}

/**
 * Derives a deterministic façade boot sequence while enforcing shared configuration contracts.
 *
 * @param options - User-provided façade options.
 * @returns {@link FacadeInitResult} referencing the engine bootstrap configuration.
 */
export function initializeFacade(options: FacadeInitOptions): FacadeInitResult {
  const engineConfig = createEngineBootstrapConfig(options.scenarioId, options.verbose ?? false);

  return { engineConfig } satisfies FacadeInitResult;
}
