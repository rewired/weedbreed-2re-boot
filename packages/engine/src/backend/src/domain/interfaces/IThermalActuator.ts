import type { ZoneEnvironment } from '../entities.ts';

/**
 * Inputs required for computing the thermal effect of an actuator device.
 */
export interface ThermalActuatorInputs {
  /** Electrical power draw expressed in watts. */
  readonly power_W: number;
  /** Useful-work efficiency on the canonical [0,1] scale. */
  readonly efficiency01: number;
  /** Operating mode describing whether the actuator heats, cools, or auto-selects. */
  readonly mode: 'heat' | 'cool' | 'auto';
  /** Optional upper bound for heating capacity expressed in watts. */
  readonly max_heat_W?: number;
  /** Optional upper bound for cooling capacity expressed in watts. */
  readonly max_cool_W?: number;
  /** Optional temperature setpoint in degrees Celsius for auto mode. */
  readonly setpoint_C?: number;
}

/**
 * Outputs returned when evaluating a thermal actuator effect.
 */
export interface ThermalActuatorOutputs {
  /** Temperature delta expressed in kelvin. Positive values increase air temperature. */
  readonly deltaT_K: number;
  /** Electrical energy consumed during the interval expressed in watthours. */
  readonly energy_Wh: number;
  /** Actual utilised power in watts after respecting operational limits. */
  readonly used_W: number;
}

/**
 * Contract describing how thermal actuators compute their impact on a zone environment.
 *
 * Heating mode converts waste heat into a positive temperature delta via:
 * `ΔT_K = (wasteHeat_W * dt_h * 3600) / (airMass_kg * 1006)`.
 * Cooling mode removes sensible heat subject to `max_cool_W` limitations, yielding a negative `deltaT_K`.
 * Auto mode compares the provided setpoint against `envState.airTemperatureC` and selects heating or cooling accordingly.
 *
 * @see applyDeviceHeat in `engine/thermo/heat.ts` for the canonical thermodynamic constants.
 */
export interface IThermalActuator {
  /**
   * Compute the thermal effect for the provided tick.
   *
   * @param inputs - Static and dynamic actuator parameters.
   * @param envState - Snapshot of the current zone environment.
   * @param airMass_kg - Mass of air contained within the serviced zone expressed in kilograms.
   * @param dt_h - Tick duration expressed in hours.
   */
  computeEffect(
    inputs: ThermalActuatorInputs,
    envState: ZoneEnvironment,
    airMass_kg: number,
    dt_h: number,
  ): ThermalActuatorOutputs;
}
