import type { ZoneEnvironment } from '../entities.ts';

/**
 * Inputs required for humidity actuators that add or remove moisture from air.
 */
export interface HumidityActuatorInputs {
  /** Operating mode describing whether the actuator humidifies or dehumidifies. */
  readonly mode: 'dehumidify' | 'humidify';
  /** Optional water removal or addition capacity expressed in litres per hour. */
  readonly capacity_L_per_h?: number;
  /** Optional water removal or addition capacity expressed in grams per hour. */
  readonly capacity_g_per_h?: number;
}

/**
 * Outputs produced by humidity actuators for telemetry and downstream stages.
 */
export interface HumidityActuatorOutputs {
  /** Change in relative humidity on the canonical [0,1] scale. */
  readonly deltaRH01: number;
  /** Positive values indicate removed water in grams; negative values indicate added water. */
  readonly water_g: number;
  /** Optional electrical energy expenditure expressed in watthours. */
  readonly energy_Wh?: number;
}

/**
 * Contract describing how humidity actuators adjust the zone environment.
 *
 * Proxy model uses a temperature-dependent factor `k_rh(T)` such that:
 * `ΔrH01 ≈ k_rh(T) * (± water_g) / airMass_kg`.
 * Dehumidifiers remove moisture via `removed_water_g = clamp(capacity_g_per_h * dt_h, 0, max)`.
 * Humidifiers add moisture via the same formulation but with inverted sign.
 * Phase 1 omits latent heat coupling; future phases will extend `ZoneEnvironment` with `relativeHumidity01`.
 */
export interface IHumidityActuator {
  /**
   * Compute the humidity delta for the provided tick.
   *
   * @param inputs - Static and dynamic actuator parameters.
   * @param envState - Snapshot of the current zone environment.
   * @param airMass_kg - Mass of air contained within the serviced zone expressed in kilograms.
   * @param dt_h - Tick duration expressed in hours.
   */
  computeEffect(
    inputs: HumidityActuatorInputs,
    envState: ZoneEnvironment,
    airMass_kg: number,
    dt_h: number,
  ): HumidityActuatorOutputs;
}
