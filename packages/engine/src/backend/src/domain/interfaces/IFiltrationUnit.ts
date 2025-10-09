/**
 * Inputs describing filtration unit behaviour when chained after airflow actuators.
 */
export interface FiltrationUnitInputs {
  /** Incoming volumetric airflow expressed in cubic metres per hour. */
  readonly airflow_m3_per_h: number;
  /** Filter media type controlling removal behaviour. */
  readonly filterType: 'carbon' | 'hepa' | 'pre-filter';
  /** Removal efficiency on the canonical [0,1] scale. */
  readonly efficiency01: number;
  /** Filter condition on the canonical [0,1] scale representing clogging or ageing. */
  readonly condition01: number;
  /** Baseline pressure drop characteristic for the clean filter media, expressed in pascal. */
  readonly basePressureDrop_pa: number;
}

/**
 * Outputs describing filtration performance and its impact on upstream airflow.
 */
export interface FiltrationUnitOutputs {
  /** Change in odour concentration expressed as a unitless proxy (negative reduces odour). */
  readonly odor_concentration_delta: number;
  /** Particulate removal on the canonical [0,1] scale. */
  readonly particulateRemoval01: number;
  /** Pressure drop across the filter expressed in pascal. */
  readonly pressure_drop_pa: number;
  /** Reduction in volumetric airflow due to pressure drop expressed in cubic metres per hour. */
  readonly airflow_reduction_m3_per_h: number;
}

/**
 * Contract for filtration units chained with airflow actuators.
 *
 * Phase 1 implements a proxy odour model while tracking particulate removal and pressure drops.
 * Pressure drop increases with deteriorating `condition01`, reducing the effective airflow passed downstream.
 * Supports Pattern C fan→filter chains where upstream actuator output feeds the filter input.
 */
export interface IFiltrationUnit {
  /**
   * Compute filtration impact for the provided tick.
   *
   * @param inputs - Static and dynamic filtration parameters.
   * @param dt_h - Tick duration expressed in hours.
   */
  computeEffect(inputs: FiltrationUnitInputs, dt_h: number): FiltrationUnitOutputs;
}
