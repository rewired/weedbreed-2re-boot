import type { DeviceInstance, SensorMeasurementType } from '../entities.ts';
import type { RandomNumberGenerator } from '../../util/rng.ts';

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
  /** Ground-truth value captured prior to noise injection. */
  readonly trueValue: T;
  /** Normalised noise strength applied during sampling. */
  readonly noise01: number;
  /** Device condition applied when scaling noise. */
  readonly condition01: number;
  /** Deterministic noise sample applied before clamping. */
  readonly noiseSample: number;
}

/**
 * Canonical runtime representation of a sensor reading emitted by the pipeline.
 */
export interface SensorReading<T> extends SensorOutputs<T> {
  /** Measurement class captured by the sensor. */
  readonly measurementType: SensorMeasurementType;
  /** RNG stream identifier backing deterministic sampling. */
  readonly rngStreamId: string;
  /** Absolute simulation clock (hours) when the reading was captured. */
  readonly sampledAtSimTimeHours: number;
  /** Discrete tick index resolved from the simulation clock. */
  readonly sampledTick: number;
  /** Tick duration in hours used to resolve {@link sampledTick}. */
  readonly tickDurationHours: number;
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
