import {
  AMBIENT_CO2_PPM,
  FLOAT_TOLERANCE,
  HOURS_PER_TICK
} from '../constants/simConstants.js';
import type {
  Co2InjectorInputs,
  Co2InjectorOutputs,
  ICo2Injector
} from '../domain/interfaces/ICo2Injector.js';
import type { ZoneEnvironment } from '../domain/entities.js';
import { clamp01 } from '../util/math.js';
import { resolveTickHoursValue } from '../engine/resolveTickHours.js';

function ensureFinite(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return value;
}

function resolveBaseline(
  env: ZoneEnvironment,
  ambient_ppm: number | undefined,
  min_ppm: number | undefined
): number {
  const envReading = ensureFinite(env.co2_ppm, Number.NaN);

  if (Number.isFinite(envReading)) {
    return Math.max(0, envReading);
  }

  if (Number.isFinite(ambient_ppm)) {
    return Math.max(0, ambient_ppm as number);
  }

  if (Number.isFinite(min_ppm)) {
    return Math.max(0, min_ppm as number);
  }

  return AMBIENT_CO2_PPM;
}

function normaliseBound(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value as number);
}

function ensureFiniteOutputs(outputs: Co2InjectorOutputs): Co2InjectorOutputs {
  const { delta_ppm, requestedDelta_ppm, energy_Wh, effectiveDuty01 } = outputs;

  if (
    !Number.isFinite(delta_ppm) ||
    !Number.isFinite(requestedDelta_ppm) ||
    !Number.isFinite(energy_Wh) ||
    !Number.isFinite(effectiveDuty01)
  ) {
    throw new Error('CO₂ injector outputs must be finite numbers.');
  }

  return outputs;
}

export function createCo2InjectorStub(): ICo2Injector {
  return {
    computeEffect(
      inputs: Co2InjectorInputs,
      envState: ZoneEnvironment,
      dt_h: number
    ): Co2InjectorOutputs {
      const resolvedDt_h = resolveTickHoursValue(dt_h);

      if (!Number.isFinite(resolvedDt_h) || resolvedDt_h <= 0) {
        return {
          delta_ppm: 0,
          requestedDelta_ppm: 0,
          energy_Wh: 0,
          effectiveDuty01: 0,
          clampedByTarget: false,
          clampedBySafety: false
        } satisfies Co2InjectorOutputs;
      }

      const dutyCycle01 = clamp01(ensureFinite(inputs.dutyCycle01, 0));
      const pulse_ppm_per_tick = Math.max(0, ensureFinite(inputs.pulse_ppm_per_tick, 0));

      if (dutyCycle01 <= 0 || pulse_ppm_per_tick <= 0) {
        return {
          delta_ppm: 0,
          requestedDelta_ppm: 0,
          energy_Wh: 0,
          effectiveDuty01: 0,
          clampedByTarget: false,
          clampedBySafety: false
        } satisfies Co2InjectorOutputs;
      }

      const scale = resolvedDt_h / HOURS_PER_TICK;
      const capacityAtDuty1 = pulse_ppm_per_tick * Math.max(0, scale);
      const commandedCapacity = capacityAtDuty1 * dutyCycle01;

      if (commandedCapacity <= 0) {
        return {
          delta_ppm: 0,
          requestedDelta_ppm: 0,
          energy_Wh: 0,
          effectiveDuty01: 0,
          clampedByTarget: false,
          clampedBySafety: false
        } satisfies Co2InjectorOutputs;
      }

      const min_ppm = Number.isFinite(inputs.min_ppm) ? Math.max(0, inputs.min_ppm as number) : undefined;
      const ambient_ppm = Number.isFinite(inputs.ambient_ppm)
        ? Math.max(0, inputs.ambient_ppm as number)
        : undefined;
      const hysteresis_ppm = Number.isFinite(inputs.hysteresis_ppm)
        ? Math.max(0, inputs.hysteresis_ppm as number)
        : 0;

      const current_ppm = resolveBaseline(envState, ambient_ppm, min_ppm);
      const target_ppm = Math.max(
        current_ppm,
        normaliseBound(inputs.target_ppm, current_ppm),
        min_ppm ?? 0
      );

      const requestedDelta_ppm = Math.max(0, target_ppm - current_ppm);

      if (requestedDelta_ppm <= hysteresis_ppm + FLOAT_TOLERANCE) {
        return ensureFiniteOutputs({
          delta_ppm: 0,
          requestedDelta_ppm,
          energy_Wh: 0,
          effectiveDuty01: 0,
          clampedByTarget: true,
          clampedBySafety: false
        });
      }

      const safetyCeiling_ppm = normaliseBound(inputs.safetyMax_ppm, Number.POSITIVE_INFINITY);
      const safetyHeadroom_ppm = safetyCeiling_ppm - current_ppm;

      if (!Number.isFinite(safetyHeadroom_ppm) || safetyHeadroom_ppm <= 0) {
        return ensureFiniteOutputs({
          delta_ppm: 0,
          requestedDelta_ppm,
          energy_Wh: 0,
          effectiveDuty01: 0,
          clampedByTarget: false,
          clampedBySafety: true
        });
      }

      const deliverable_ppm = Math.max(
        0,
        Math.min(commandedCapacity, requestedDelta_ppm, safetyHeadroom_ppm)
      );

      if (deliverable_ppm <= FLOAT_TOLERANCE) {
        return ensureFiniteOutputs({
          delta_ppm: 0,
          requestedDelta_ppm,
          energy_Wh: 0,
          effectiveDuty01: 0,
          clampedByTarget: requestedDelta_ppm > FLOAT_TOLERANCE,
          clampedBySafety: safetyHeadroom_ppm <= FLOAT_TOLERANCE
        });
      }

      const effectiveDuty01 = clamp01(
        capacityAtDuty1 > 0 ? deliverable_ppm / capacityAtDuty1 : 0
      );
      const power_W = Math.max(0, ensureFinite(inputs.power_W, 0));
      const energy_Wh = power_W * resolvedDt_h * effectiveDuty01;
      const clampedByTarget = deliverable_ppm + FLOAT_TOLERANCE < requestedDelta_ppm;
      const clampedBySafety =
        Number.isFinite(safetyCeiling_ppm) && deliverable_ppm + FLOAT_TOLERANCE < safetyHeadroom_ppm;

      return ensureFiniteOutputs({
        delta_ppm: deliverable_ppm,
        requestedDelta_ppm,
        energy_Wh,
        effectiveDuty01,
        clampedByTarget,
        clampedBySafety
      });
    }
  } satisfies ICo2Injector;
}

export default createCo2InjectorStub;
