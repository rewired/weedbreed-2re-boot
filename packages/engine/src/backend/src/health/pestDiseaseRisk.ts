import { clamp, clamp01 } from '../util/math.js';
import type { ZoneEnvironment } from '../domain/world.js';
import type { PestDiseaseRiskLevel } from '../domain/health/pestDisease.js';

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

export const PEST_DISEASE_RISK_LEVEL_THRESHOLDS = {
  moderate: 0.35,
  high: 0.7,
} as const;

export const TEMPERATURE_COMFORT_RANGE_C = { min: 20, max: 26 } as const;
export const HUMIDITY_COMFORT_RANGE_PCT = { min: 45, max: 60 } as const;
export const MAX_TEMPERATURE_DEVIATION_C = 10;
export const MAX_HUMIDITY_DEVIATION_PCT = 25;
export const TEMPERATURE_WEIGHT = 0.35;
export const HUMIDITY_WEIGHT = 0.25;
export const HYGIENE_WEIGHT = 0.4;
export const BASE_DECAY_RATE = 0.12;
export const QUARANTINE_DECAY_BONUS = 0.18;

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
      inputs.environment.relativeHumidity_pct,
      HUMIDITY_COMFORT_RANGE_PCT,
      MAX_HUMIDITY_DEVIATION_PCT,
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
