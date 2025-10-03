/**
 * Inputs describing substrate or solution nutrient buffer behaviour.
 */
export interface NutrientBufferInputs {
  /** Maximum buffer capacity for each nutrient expressed in milligrams. */
  readonly capacity_mg: Record<string, number>;
  /** Current buffered quantity for each nutrient expressed in milligrams. */
  readonly buffer_mg: Record<string, number>;
  /** Fraction of inflow lost to leaching on the canonical [0,1] scale. */
  readonly leaching01: number;
  /** Incoming nutrient flow from irrigation expressed in milligrams per tick. */
  readonly flow_mg: Record<string, number>;
  /** Uptake demand from the zone or individual plants expressed in milligrams. */
  readonly uptake_demand_mg: Record<string, number>;
  /** Nutrient source descriptor inherited from the cultivation method blueprint. */
  readonly nutrientSource: 'substrate' | 'solution' | 'mixed';
}

/**
 * Outputs representing nutrient movement following buffer evaluation.
 */
export interface NutrientBufferOutputs {
  /** Actual uptake satisfied for each nutrient expressed in milligrams. */
  readonly uptake_mg: Record<string, number>;
  /** Nutrient quantity lost to leaching for each nutrient expressed in milligrams. */
  readonly leached_mg: Record<string, number>;
  /** Updated buffer inventory for each nutrient expressed in milligrams. */
  readonly new_buffer_mg: Record<string, number>;
}

/**
 * Contract for nutrient buffers managing substrate or solution nutrient inventories.
 *
 * Deterministic order:
 * 1. Leaching: `leach = flow_mg * leaching01` (per nutrient).
 * 2. Availability: `available = buffer_mg + (flow_mg - leach)`.
 * 3. Uptake: `uptake = clamp(uptake_demand_mg, 0, available)`.
 * 4. Buffer update: `buffer := clamp(buffer + (flow_mg - leach - uptake), 0, capacity)`.
 *
 * Phase 1 omits explicit water accounting; future extensions introduce moisture coupling.
 */
export interface INutrientBuffer {
  /**
   * Compute nutrient fluxes for the provided tick.
   *
   * @param inputs - Static and dynamic buffer parameters.
   * @param dt_h - Tick duration expressed in hours.
   */
  computeEffect(inputs: NutrientBufferInputs, dt_h: number): NutrientBufferOutputs;
}
