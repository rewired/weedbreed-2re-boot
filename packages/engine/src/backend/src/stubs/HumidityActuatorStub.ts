import type {
  HumidityActuatorInputs,
  HumidityActuatorOutputs,
  IHumidityActuator
} from '../domain/interfaces/IHumidityActuator.ts';
import type { ZoneEnvironment } from '../domain/entities.ts';
import { clamp } from '../util/math.ts';
import { resolveAirMassKg } from '../util/environment.ts';
import { resolveTickHoursValue } from '../engine/resolveTickHours.ts';
import {
  HUMIDITY_FACTOR_FALLBACK,
  HUMIDITY_FACTOR_MAX,
  HUMIDITY_FACTOR_MIN,
  HUMIDITY_FACTOR_TABLE
} from '../constants/climate.ts';

function ensureFiniteOutputs(
  outputs: HumidityActuatorOutputs
): HumidityActuatorOutputs {
  const { deltaRH_pct, water_g, energy_Wh } = outputs;

  if (
    !Number.isFinite(deltaRH_pct) ||
    !Number.isFinite(water_g) ||
    !Number.isFinite(energy_Wh ?? 0)
  ) {
    throw new Error('Humidity actuator outputs must be finite numbers.');
  }

  return outputs;
}

function getHumidityFactor_k_rh(tempC: number): number {
  if (!Number.isFinite(tempC)) {
    return HUMIDITY_FACTOR_FALLBACK;
  }

  if (tempC <= HUMIDITY_FACTOR_TABLE[0].tempC) {
    return clamp(
      HUMIDITY_FACTOR_TABLE[0].factor,
      HUMIDITY_FACTOR_MIN,
      HUMIDITY_FACTOR_MAX
    );
  }

  for (let i = 1; i < HUMIDITY_FACTOR_TABLE.length; i += 1) {
    const lower = HUMIDITY_FACTOR_TABLE[i - 1];
    const upper = HUMIDITY_FACTOR_TABLE[i];

    if (tempC <= upper.tempC) {
      const span = upper.tempC - lower.tempC;
      const ratio = span === 0 ? 0 : (tempC - lower.tempC) / span;
      const interpolated = lower.factor + ratio * (upper.factor - lower.factor);

      return clamp(interpolated, HUMIDITY_FACTOR_MIN, HUMIDITY_FACTOR_MAX);
    }
  }

  return clamp(
    HUMIDITY_FACTOR_TABLE[HUMIDITY_FACTOR_TABLE.length - 1].factor,
    HUMIDITY_FACTOR_MIN,
    HUMIDITY_FACTOR_MAX
  );
}

function resolveCapacityGramsPerHour(
  inputs: HumidityActuatorInputs
): number {
  const { capacity_g_per_h, capacity_L_per_h } = inputs;

  if (typeof capacity_g_per_h === 'number') {
    if (!Number.isFinite(capacity_g_per_h) || capacity_g_per_h < 0) {
      throw new RangeError('capacity_g_per_h must be a non-negative finite number.');
    }

    return capacity_g_per_h;
  }

  if (typeof capacity_L_per_h === 'number') {
    if (!Number.isFinite(capacity_L_per_h) || capacity_L_per_h < 0) {
      throw new RangeError('capacity_L_per_h must be a non-negative finite number.');
    }

    return capacity_L_per_h * 1_000;
  }

  throw new Error('Humidity actuator requires capacity_g_per_h or capacity_L_per_h');
}

function clampTickCapacity(
  capacity_g_per_h: number,
  dt_h: number
): number {
  return clamp(capacity_g_per_h * dt_h, 0, Number.POSITIVE_INFINITY);
}

export function createHumidityActuatorStub(): IHumidityActuator {
  return {
    computeEffect(
      inputs: HumidityActuatorInputs,
      envState: ZoneEnvironment,
      airMass_kg: number,
      dt_h: number,
    ): HumidityActuatorOutputs {
      if (
        typeof dt_h === 'number' &&
        (!Number.isFinite(dt_h) || dt_h <= 0)
      ) {
        return { deltaRH_pct: 0, water_g: 0, energy_Wh: 0 };
      }

      const resolvedDt_h = resolveTickHoursValue(dt_h);
      const resolvedAirMass = resolveAirMassKg(airMass_kg);

      if (resolvedDt_h === 0 || resolvedAirMass === 0) {
        return { deltaRH_pct: 0, water_g: 0, energy_Wh: 0 };
      }

      const capacity_g_per_h = resolveCapacityGramsPerHour(inputs);

      if (capacity_g_per_h === 0) {
        return { deltaRH_pct: 0, water_g: 0, energy_Wh: 0 };
      }

      const tickCapacity_g = clampTickCapacity(capacity_g_per_h, resolvedDt_h);

      if (tickCapacity_g === 0) {
        return { deltaRH_pct: 0, water_g: 0, energy_Wh: 0 };
      }

      const mode = inputs.mode;

      if (mode === 'dehumidify') {
        const humidityFactor = getHumidityFactor_k_rh(envState.airTemperatureC);
        const deltaRH_pct = -humidityFactor * (tickCapacity_g / resolvedAirMass);

        return ensureFiniteOutputs({
          deltaRH_pct,
          water_g: tickCapacity_g,
          energy_Wh: 0
        });
      }

      if (mode === 'humidify') {
        const humidityFactor = getHumidityFactor_k_rh(envState.airTemperatureC);
        const deltaRH_pct = humidityFactor * (tickCapacity_g / resolvedAirMass);

        return ensureFiniteOutputs({
          deltaRH_pct,
          water_g: -tickCapacity_g,
          energy_Wh: 0
        });
      }

      throw new Error('Unsupported humidity actuator mode');
    }
  } satisfies IHumidityActuator;
}
