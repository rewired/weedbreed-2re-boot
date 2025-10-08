import type { ZoneEnvironment } from '../entities.ts';

/**
 * Inputs required to evaluate a CO₂ injector actuator.
 */
export interface Co2InjectorInputs {
  /** Electrical power draw expressed in watts. */
  readonly power_W: number;
  /** Duty cycle applied during the tick on the canonical [0,1] scale. */
  readonly dutyCycle01: number;
  /** Desired CO₂ concentration setpoint expressed in parts per million. */
  readonly target_ppm: number;
  /** Maximum permissible CO₂ concentration expressed in parts per million. */
  readonly safetyMax_ppm: number;
  /**
   * Injector capacity expressed as ppm contribution per canonical tick when
   * running at a duty cycle of 1.0.
   */
  readonly pulse_ppm_per_tick: number;
  /** Optional lower bound for enrichment expressed in ppm. */
  readonly min_ppm?: number;
  /** Optional ambient fallback used when the environment lacks a reading. */
  readonly ambient_ppm?: number;
  /** Optional hysteresis width expressed in ppm for telemetry purposes. */
  readonly hysteresis_ppm?: number;
}

/**
 * Outputs reported by a CO₂ injector evaluation.
 */
export interface Co2InjectorOutputs {
  /** Actual enrichment applied to the zone expressed in ppm. */
  readonly delta_ppm: number;
  /** Requested enrichment prior to clamping expressed in ppm. */
  readonly requestedDelta_ppm: number;
  /** Electrical energy consumed during the interval expressed in watthours. */
  readonly energy_Wh: number;
  /** Effective duty cycle utilised on the canonical [0,1] scale. */
  readonly effectiveDuty01: number;
  /** Indicates whether the requested target limited the delivered enrichment. */
  readonly clampedByTarget: boolean;
  /** Indicates whether the safety ceiling limited the delivered enrichment. */
  readonly clampedBySafety: boolean;
}

/**
 * Contract describing how CO₂ injectors influence the well-mixed zone
 * environment.
 */
export interface ICo2Injector {
  computeEffect(
    inputs: Co2InjectorInputs,
    envState: ZoneEnvironment,
    dt_h: number
  ): Co2InjectorOutputs;
}
