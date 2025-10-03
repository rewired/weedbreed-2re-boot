import type { DeviceInstance } from '../entities.js';
import type { RandomNumberGenerator } from '../../util/rng.js';

/**
 * Helper type describing device condition metadata influencing sensor performance.
 */
export type SensorDeviceContext = Pick<DeviceInstance, 'condition01'>;

/**
 * Inputs required to evaluate a sensor measurement.
 */
export interface SensorInputs<T> {
  /** Ground-truth value captured from the environment. */
  readonly trueValue: T;
  /** Noise strength on the canonical [0,1] scale. */
  readonly noise01: number;
  /** Device condition on the canonical [0,1] scale influencing noise amplification. */
  readonly condition01: number;
}

/**
 * Outputs returned by sensor evaluations.
 */
export interface SensorOutputs<T> {
  /** Measured value after noise application. */
  readonly measuredValue: T;
  /** Absolute measurement error derived from the measured and true values. */
  readonly error: number;
}

/**
 * Generic contract for sensors sampling environmental state before actuator application (Pattern D).
 *
 * Noise model follows `measuredValue = trueValue + noise * (1 - condition01) * randomGaussian(rng)` for numeric readings.
 * Deterministic `RandomNumberGenerator` ensures repeatable telemetry in accordance with SEC §1 determinism requirements.
 */
export interface ISensor<T> {
  /**
   * Sample the environment and return a noisy measurement.
   *
   * @param inputs - Sensor ground-truth and degradation parameters.
   * @param rng - Deterministic random number generator instance.
   */
  computeEffect(inputs: SensorInputs<T>, rng: RandomNumberGenerator): SensorOutputs<T>;
}
