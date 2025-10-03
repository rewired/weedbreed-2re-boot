import type { Zone } from '../entities.js';

/**
 * Helper type describing the zone properties used to derive air volume.
 */
export type ZoneVolumeContext = Pick<Zone, 'floorArea_m2' | 'height_m'>;

/**
 * Inputs describing airflow actuator behaviour.
 */
export interface AirflowActuatorInputs {
  /** Volumetric airflow expressed in cubic metres per hour. */
  readonly airflow_m3_per_h: number;
  /** Operating mode describing how air is routed within or outside the zone. */
  readonly mode: 'recirculation' | 'exhaust' | 'intake';
  /** Duty cycle on the canonical [0,1] scale representing on-time fraction. */
  readonly dutyCycle01: number;
}

/**
 * Telemetry outputs for airflow actuators.
 */
export interface AirflowActuatorOutputs {
  /** Effective volumetric airflow after considering duty cycle and losses. */
  readonly effective_airflow_m3_per_h: number;
  /** Air changes per hour induced within the serviced zone. */
  readonly ach: number;
  /** Optional pressure loss across downstream components expressed in pascal. */
  readonly pressure_loss_pa?: number;
  /** Optional electrical energy consumed during the interval expressed in watthours. */
  readonly energy_Wh?: number;
}

/**
 * Contract for airflow actuators contributing to zone ventilation.
 *
 * Effective airflow equals `airflow_m3_per_h * dutyCycle01` with optional reductions from chained filters.
 * Air changes per hour follow `ach = effective_airflow_m3_per_h / zoneVolume_m3`.
 * Supports Pattern C fan→filter chains where downstream filters adjust pressure and flow characteristics.
 */
export interface IAirflowActuator {
  /**
   * Compute the airflow effect for the provided tick.
   *
   * @param inputs - Static and dynamic actuator parameters.
   * @param zoneVolume_m3 - Interior zone volume expressed in cubic metres (derived from {@link ZoneVolumeContext}).
   * @param dt_h - Tick duration expressed in hours.
   */
  computeEffect(
    inputs: AirflowActuatorInputs,
    zoneVolume_m3: number,
    dt_h: number,
  ): AirflowActuatorOutputs;
}
