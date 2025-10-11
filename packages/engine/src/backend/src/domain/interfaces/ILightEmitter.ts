/**
 * Inputs describing light-emitting device parameters.
 */
export interface LightEmitterInputs {
  /** Photosynthetic photon flux density at the canopy centre expressed in µmol·m⁻²·s⁻¹. */
  readonly ppfd_center_umol_m2s: number;
  /** Effective coverage area expressed in square metres. */
  readonly coverage_m2: number;
  /** Dimming factor on the canonical [0,1] scale (0 = off, 1 = full output). */
  readonly dim01: number;
}

/**
 * Telemetry outputs when evaluating a light emitter during a tick.
 */
export interface LightEmitterOutputs {
  /** Effective PPFD delivered to the serviced canopy expressed in µmol·m⁻²·s⁻¹. */
  readonly ppfd_effective_umol_m2s: number;
  /** Daily light integral increment for the tick expressed in mol·m⁻²·d⁻¹. */
  readonly dli_mol_m2d_inc: number;
  /** Optional electrical energy consumed during the interval expressed in watthours. */
  readonly energy_Wh?: number;
}

/**
 * Contract for light emitters contributing photosynthetic photons to a zone.
 *
 * Plateau-field assumption keeps PPFD constant within `coverage_m2` at `ppfd_center * dim01`.
 * Daily light integral increment is derived from `PPFD * (dt_h * 3600) / 1e6`.
 * Energy accounting remains optional unless the blueprint exposes `power_W`.
 * Future phases extend `Zone` with PPFD/DLI state while respecting `LightSchedule` governance.
 */
export interface ILightEmitter {
  /**
   * Compute the lighting effect for the provided tick.
   *
   * @param inputs - Static and dynamic emitter parameters.
   * @param dt_h - Tick duration expressed in hours.
   */
  computeEffect(inputs: LightEmitterInputs, dt_h: number): LightEmitterOutputs;
}
