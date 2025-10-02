/**
 * Describes the configuration required to bootstrap the Weed Breed simulation engine.
 */
export interface EngineBootstrapConfig {
  /**
   * Unique identifier of the simulation scenario that should be loaded.
   */
  readonly scenarioId: string;

  /**
   * Determines whether the engine should emit verbose lifecycle diagnostics.
   */
  readonly verbose: boolean;
}

/**
 * Creates a default engine bootstrap configuration while ensuring deterministic behaviour.
 *
 * @param scenarioId - Unique identifier of the simulation scenario.
 * @param verbose - Flag that toggles verbose logging for diagnostics.
 * @returns A fully qualified {@link EngineBootstrapConfig} instance.
 */
export function createEngineBootstrapConfig(
  scenarioId: string,
  verbose = false
): EngineBootstrapConfig {
  if (!scenarioId) {
    throw new Error('scenarioId must be a non-empty string');
  }

  return {
    scenarioId,
    verbose
  } satisfies EngineBootstrapConfig;
}

export * from './backend/src/constants/simConstants.js';
