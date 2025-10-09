import {
  BASE_DECAY_RATE,
  HUMIDITY_COMFORT_RANGE01,
  HUMIDITY_WEIGHT,
  MAX_HUMIDITY_DEVIATION01,
  MAX_TEMPERATURE_DEVIATION_C,
  PEST_DISEASE_RISK_LEVEL_THRESHOLDS,
  QUARANTINE_DECAY_BONUS,
  TEMPERATURE_COMFORT_RANGE_C,
  TEMPERATURE_WEIGHT,
  HYGIENE_WEIGHT
} from '../constants/climate.ts';
import { clamp, clamp01 } from '../util/math.ts';
import type { ZoneEnvironment } from '../domain/world.ts';
import type { PestDiseaseRiskLevel } from '../domain/health/pestDisease.ts';

export interface PestDiseaseRiskInputs {
  readonly environment: ZoneEnvironment;
  readonly hygieneScore01: number;
  readonly previousRisk01: number;
  readonly isQuarantined: boolean;
}

export interface PestDiseaseRiskContributions {
  readonly temperature: number;
  readonly humidity: number;
  readonly hygiene: number;
  readonly decay: number;
}

export interface PestDiseaseRiskResult {
  readonly risk01: number;
  readonly contributions: PestDiseaseRiskContributions;
}

function normalisedDeviation(value: number, range: { min: number; max: number }, maxDeviation: number): number {
  const clamped = clamp(value, range.min, range.max);
  const deviation = Math.abs(value - clamped);
  if (maxDeviation <= 0) {
    return 0;
  }
  return clamp01(deviation / maxDeviation);
}

export function resolveRiskLevel(risk01: number): PestDiseaseRiskLevel {
  if (risk01 >= PEST_DISEASE_RISK_LEVEL_THRESHOLDS.high) {
    return 'high';
  }

  if (risk01 >= PEST_DISEASE_RISK_LEVEL_THRESHOLDS.moderate) {
    return 'moderate';
  }

  return 'low';
}

export function evaluatePestDiseaseRisk(inputs: PestDiseaseRiskInputs): PestDiseaseRiskResult {
  const temperaturePressure =
    normalisedDeviation(inputs.environment.airTemperatureC, TEMPERATURE_COMFORT_RANGE_C, MAX_TEMPERATURE_DEVIATION_C) *
    TEMPERATURE_WEIGHT;
  const humidityPressure =
    normalisedDeviation(
      inputs.environment.relativeHumidity01,
      HUMIDITY_COMFORT_RANGE01,
      MAX_HUMIDITY_DEVIATION01,
    ) * HUMIDITY_WEIGHT;
  const hygienePressure = clamp01(1 - clamp01(inputs.hygieneScore01)) * HYGIENE_WEIGHT;
  const totalPressure = temperaturePressure + humidityPressure + hygienePressure;

  const decayRate = BASE_DECAY_RATE + (inputs.isQuarantined ? QUARANTINE_DECAY_BONUS : 0);
  const decay = clamp01(inputs.previousRisk01 * decayRate);
  const retainedRisk = clamp01(inputs.previousRisk01 - decay);
  const risk01 = clamp01(retainedRisk + totalPressure);

  return {
    risk01,
    contributions: {
      temperature: temperaturePressure,
      humidity: humidityPressure,
      hygiene: hygienePressure,
      decay,
    },
  } satisfies PestDiseaseRiskResult;
}

export { PEST_DISEASE_RISK_LEVEL_THRESHOLDS } from '../constants/climate.ts';
