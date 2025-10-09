import {
  AMBIENT_CO2_PPM,
  SAFETY_MAX_CO2_PPM
} from './simConstants.ts';

export const HUMIDITY_FACTOR_TABLE = [
  { tempC: 15, factor: 0.12 },
  { tempC: 20, factor: 0.14 },
  { tempC: 25, factor: 0.15 },
  { tempC: 30, factor: 0.16 }
] as const;

export const HUMIDITY_FACTOR_MIN = 0.1 as const;
export const HUMIDITY_FACTOR_MAX = 0.18 as const;
export const HUMIDITY_FACTOR_FALLBACK = 0.15 as const;

export const RELATIVE_HUMIDITY_MIN01 = 0 as const;
export const RELATIVE_HUMIDITY_MAX01 = 1 as const;

export const TEMPERATURE_SENSOR_MIN_C = -50 as const;
export const TEMPERATURE_SENSOR_MAX_C = 150 as const;

export const HUMIDITY_SENSOR_MIN01 = 0 as const;
export const HUMIDITY_SENSOR_MAX01 = 1 as const;

export const MIN_AIR_CHANGES_PER_HOUR = 1 as const;
export const LEGACY_DEHUMIDIFIER_CAPACITY_G_PER_H = 500 as const;
export const LEGACY_HUMIDIFIER_CAPACITY_G_PER_H = 300 as const;

export const PEST_DISEASE_RISK_LEVEL_THRESHOLDS = {
  moderate: 0.35,
  high: 0.7
} as const;

export const HUMIDITY_MIN = PEST_DISEASE_RISK_LEVEL_THRESHOLDS.moderate;
export const HUMIDITY_MAX = PEST_DISEASE_RISK_LEVEL_THRESHOLDS.high;

export const TEMPERATURE_COMFORT_RANGE_C = { min: 20, max: 26 } as const;
export const HUMIDITY_COMFORT_RANGE01 = { min: 0.45, max: 0.6 } as const;
export const MAX_TEMPERATURE_DEVIATION_C = 10 as const;
export const MAX_HUMIDITY_DEVIATION01 = 0.25 as const;
export const TEMPERATURE_WEIGHT = 0.35 as const;
export const HUMIDITY_WEIGHT = 0.25 as const;
export const HYGIENE_WEIGHT = 0.4 as const;
export const BASE_DECAY_RATE = 0.12 as const;
export const QUARANTINE_DECAY_BONUS = 0.18 as const;

export { AMBIENT_CO2_PPM, SAFETY_MAX_CO2_PPM };
