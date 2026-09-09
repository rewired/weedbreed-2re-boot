import * as workforceConstants from './simConstants.workforce.ts';
import type { SimulationConstants } from './simConstants.types.ts';

export * from './simConstants.workforce.ts';
export type { SimulationConstants } from './simConstants.types.ts';

/**
 * Canonical constant describing the minimal calculable floor area, expressed
 * in square metres.
 */
export const AREA_QUANTUM_M2 = 0.25 as const;

/**
 * Canonical constant describing the light schedule grid resolution, expressed
 * in in-game hours (15 minutes per step).
 */
export const LIGHT_SCHEDULE_GRID_HOURS = 0.25 as const;

/**
 * Canonical constant describing the number of seconds contained in an
 * in-game hour.
 */
export const SECONDS_PER_HOUR = 3_600 as const;

/**
 * Canonical constant describing the default height of a room interior,
 * expressed in metres.
 */
export const ROOM_DEFAULT_HEIGHT_M = 3 as const;

/**
 * Canonical constant describing the specific heat capacity of dry air at
 * constant pressure, expressed in joules per kilogram and kelvin.
 */
export const CP_AIR_J_PER_KG_K = 1_005 as const;

/**
 * Canonical constant describing the latent heat of vaporisation for water at
 * standard atmospheric pressure (SEC §6.3.2), expressed in joules per
 * kilogram.
 */
export const LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG = 2_260_000 as const;

/**
 * Canonical constant describing the density of dry air at standard conditions,
 * expressed in kilograms per cubic metre.
 */
export const AIR_DENSITY_KG_PER_M3 = 1.2041 as const;

/**
 * Canonical constant describing the default ambient CO₂ concentration used
 * when zones have no explicit reading, expressed in parts per million.
 */
export const AMBIENT_CO2_PPM = 420 as const;

/**
 * Canonical constant describing the maximum safe CO₂ concentration in a zone,
 * expressed in parts per million. Derived from occupational safety guidance
 * (8-hour exposure) and enforced as a hard clamp during environment updates.
 */
export const SAFETY_MAX_CO2_PPM = 5_000 as const;

/**
 * Canonical constant describing the number of in-game hours represented by a
 * single simulation tick.
 */
export const HOURS_PER_TICK = 1 as const;

/**
 * Canonical constant describing the number of in-game hours contained within a
 * single day.
 */
export const HOURS_PER_DAY = 24 as const;

/**
 * Canonical constant describing the number of in-game days contained within a
 * single month.
 */
export const DAYS_PER_MONTH = 30 as const;

/**
 * Canonical constant describing the number of in-game months contained within a
 * single year.
 */
export const MONTHS_PER_YEAR = 12 as const;

/**
 * Canonical constant describing the number of in-game hours contained within a
 * calendar month.
 */
export const HOURS_PER_MONTH = HOURS_PER_DAY * DAYS_PER_MONTH;

/**
 * Canonical constant describing the number of in-game hours contained within a
 * calendar year.
 */
export const HOURS_PER_YEAR = HOURS_PER_MONTH * MONTHS_PER_YEAR;

/**
 * Canonical floating point comparison tolerance used across the simulation.
 */
export const FLOAT_TOLERANCE = 1e-6 as const;

/**
 * Canonical relative tolerance applied when comparing floating point
 * sequences against golden references.
 */
export const EPS_REL = FLOAT_TOLERANCE;

/**
 * Canonical absolute tolerance paired with {@link EPS_REL} for comparisons
 * against golden fixtures.
 */
export const EPS_ABS = 1e-9 as const;

/** Decimal places retained by canonical persistent-state hashes. */
export const STATE_HASH_DECIMAL_PLACES = 9 as const;

/**
 * Canonical multiplier describing the number of bytes contained in a single
 * mebibyte (2^20). Used by performance budgeting to convert heap metrics to
 * MiB.
 */
export const BYTES_PER_MEBIBYTE = 1_048_576 as const;

/**
 * Canonical truncation length applied to SHA-256 digests when deriving daily
 * golden master hashes.
 */
export const HASH_KEY_BYTES = 16 as const;

/**
 * Canonical truncation length applied to SHA-256 digests when deriving
 * summary hashes for golden master fixtures.
 */
export const HASH_TRUNC_BYTES = 24 as const;

/**
 * Temporary default longitude for company headquarters metadata. Anchored to
 * Hamburg (Germany) until SEC-compliant UI capture is available.
 */
export const DEFAULT_COMPANY_LOCATION_LON = 9.9937 as const;

/**
 * Temporary default latitude for company headquarters metadata. Anchored to
 * Hamburg (Germany) until SEC-compliant UI capture is available.
 */
export const DEFAULT_COMPANY_LOCATION_LAT = 53.5511 as const;

/**
 * Canonical minimal longitude boundary expressed in decimal degrees.
 */
export const LONGITUDE_MIN_DEG = -180 as const;

/**
 * Canonical maximal longitude boundary expressed in decimal degrees.
 */
export const LONGITUDE_MAX_DEG = 180 as const;

/**
 * Canonical minimal latitude boundary expressed in decimal degrees.
 */
export const LATITUDE_MIN_DEG = -90 as const;

/**
 * Canonical maximal latitude boundary expressed in decimal degrees.
 */
export const LATITUDE_MAX_DEG = 90 as const;

/**
 * Temporary default city name for company headquarters metadata.
 */
export const DEFAULT_COMPANY_LOCATION_CITY = 'Hamburg' as const;

/**
 * Temporary default country name for company headquarters metadata.
 */
export const DEFAULT_COMPANY_LOCATION_COUNTRY = 'Deutschland' as const;

/**
 * Base yield per square meter for harvest calculations.
 */
export const BASE_YIELD_PER_M2_KG = 0.42 as const;

/**
 * Screen-of-green cultivation method yield modifier.
 */
export const SCREEN_OF_GREEN_YIELD_MODIFIER = 1.12 as const;

/**
 * Minimum yield variation factor.
 */
export const MIN_YIELD_VARIATION = 0.9 as const;

/**
 * Maximum yield variation factor.
 */
export const MAX_YIELD_VARIATION = 0.2 as const;

/**
 * Maximum age modifier reduction factor.
 */
export const MAX_AGE_MODIFIER_REDUCTION = 0.1 as const;

/**
 * Age modifier per cycle factor.
 */
export const AGE_MODIFIER_PER_CYCLE = 0.015 as const;

/**
 * Default dry matter fraction.
 */
export const DEFAULT_DRY_MATTER_FRACTION = 0.2 as const;

/**
 * Default harvest index.
 */
export const DEFAULT_HARVEST_INDEX = 0.7 as const;

/**
 * Seedling phase multiplier.
 */
export const SEEDLING_PHASE_MULTIPLIER = 0.35 as const;

/**
 * Vegetative phase multiplier.
 */
export const VEGETATIVE_PHASE_MULTIPLIER = 1 as const;

/**
 * Flowering phase multiplier.
 */
export const FLOWERING_PHASE_MULTIPLIER = 0.75 as const;

/**
 * Harvest ready phase multiplier.
 */
export const HARVEST_READY_PHASE_MULTIPLIER = 0.1 as const;

/**
 * Temperature factor divisor for Q10 calculation.
 */
export const Q10_TEMPERATURE_DIVISOR = 10 as const;

/**
 * Temperature factor clamp maximum.
 */
export const TEMPERATURE_FACTOR_CLAMP_MAX = 2 as const;

/**
 * Extreme temperature factor reduction.
 */
export const EXTREME_TEMPERATURE_FACTOR = 0.1 as const;

/**
 * Grams per kilogram conversion factor.
 */
export const GRAMS_PER_KILOGRAM = 1000 as const;

/**
 * Noise factor for biomass calculation.
 */
export const NOISE_FACTOR = 2 as const;

/**
 * Health decay rate per hour.
 */
export const HEALTH_DECAY_RATE_PER_HOUR = 0.01 as const;

/**
 * Health variation minimum.
 */
export const HEALTH_VARIATION_MIN = 0.9 as const;

/**
 * Health variation range.
 */
export const HEALTH_VARIATION_RANGE = 0.2 as const;

/**
 * Health recovery stress threshold.
 */
export const HEALTH_RECOVERY_STRESS_THRESHOLD = 0.2 as const;

/**
 * Health recovery rate per hour.
 */
export const HEALTH_RECOVERY_RATE_PER_HOUR = 0.005 as const;

/**
 * Harvest quality health weight.
 */
export const HARVEST_QUALITY_HEALTH_WEIGHT = 0.55 as const;

/**
 * Harvest quality stress weight.
 */
export const HARVEST_QUALITY_STRESS_WEIGHT = 0.25 as const;

/**
 * Harvest quality genetic weight.
 */
export const HARVEST_QUALITY_GENETIC_WEIGHT = 0.2 as const;

/**
 * Harvest quality high threshold.
 */
export const HARVEST_QUALITY_HIGH_THRESHOLD = 0.95 as const;

/**
 * Harvest quality high bonus factor.
 */
export const HARVEST_QUALITY_HIGH_BONUS_FACTOR = 0.5 as const;

/**
 * Milliseconds per second conversion factor.
 */
export const MILLISECONDS_PER_SECOND = 1000 as const;

/**
 * Single source of truth that stores the canonical simulation constants.
 *
 * The registry is frozen once to guarantee immutability and shared between
 * direct imports (`@/backend/src/constants/simConstants`) and the public
 * engine entry point (`@wb/engine`).
 */
const SIMULATION_CONSTANT_REGISTRY: Readonly<SimulationConstants> = Object.freeze({
  ...workforceConstants,
  AREA_QUANTUM_M2,
  LIGHT_SCHEDULE_GRID_HOURS,
  SECONDS_PER_HOUR,
  ROOM_DEFAULT_HEIGHT_M,
  CP_AIR_J_PER_KG_K,
  LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG,
  AIR_DENSITY_KG_PER_M3,
  AMBIENT_CO2_PPM,
  SAFETY_MAX_CO2_PPM,
  HOURS_PER_TICK,
  HOURS_PER_DAY,
  DAYS_PER_MONTH,
  MONTHS_PER_YEAR,
  HOURS_PER_MONTH,
  HOURS_PER_YEAR,
  FLOAT_TOLERANCE,
  EPS_REL,
  EPS_ABS,
  STATE_HASH_DECIMAL_PLACES,
  BYTES_PER_MEBIBYTE,
  HASH_KEY_BYTES,
  HASH_TRUNC_BYTES,
  DEFAULT_COMPANY_LOCATION_LON,
  DEFAULT_COMPANY_LOCATION_LAT,
  LONGITUDE_MIN_DEG,
  LONGITUDE_MAX_DEG,
  LATITUDE_MIN_DEG,
  LATITUDE_MAX_DEG,
  DEFAULT_COMPANY_LOCATION_CITY,
  DEFAULT_COMPANY_LOCATION_COUNTRY,
  BASE_YIELD_PER_M2_KG,
  SCREEN_OF_GREEN_YIELD_MODIFIER,
  MIN_YIELD_VARIATION,
  MAX_YIELD_VARIATION,
  MAX_AGE_MODIFIER_REDUCTION,
  AGE_MODIFIER_PER_CYCLE,
  DEFAULT_DRY_MATTER_FRACTION,
  DEFAULT_HARVEST_INDEX,
  SEEDLING_PHASE_MULTIPLIER,
  VEGETATIVE_PHASE_MULTIPLIER,
  FLOWERING_PHASE_MULTIPLIER,
  HARVEST_READY_PHASE_MULTIPLIER,
  Q10_TEMPERATURE_DIVISOR,
  TEMPERATURE_FACTOR_CLAMP_MAX,
  EXTREME_TEMPERATURE_FACTOR,
  GRAMS_PER_KILOGRAM,
  NOISE_FACTOR,
  HEALTH_DECAY_RATE_PER_HOUR,
  HEALTH_VARIATION_MIN,
  HEALTH_VARIATION_RANGE,
  HEALTH_RECOVERY_STRESS_THRESHOLD,
  HEALTH_RECOVERY_RATE_PER_HOUR,
  HARVEST_QUALITY_HEALTH_WEIGHT,
  HARVEST_QUALITY_STRESS_WEIGHT,
  HARVEST_QUALITY_GENETIC_WEIGHT,
  HARVEST_QUALITY_HIGH_THRESHOLD,
  HARVEST_QUALITY_HIGH_BONUS_FACTOR,
  MILLISECONDS_PER_SECOND
} satisfies Readonly<SimulationConstants>);

/**
 * Frozen object literal bundling all canonical simulation constants for
 * ergonomic bulk imports.
 */
export const SIM_CONSTANTS: Readonly<SimulationConstants> =
  SIMULATION_CONSTANT_REGISTRY;

/**
 * Exhaustive list of valid simulation constant identifiers.
 */
type SimulationConstantRegistry = typeof SIMULATION_CONSTANT_REGISTRY;

export type SimulationConstantName = keyof SimulationConstantRegistry;

/**
 * Returns the canonical value for a simulation constant by its identifier.
 *
 * @param name - Identifier of the canonical simulation constant.
 * @returns The canonical value associated with {@link name}.
 */
export function getSimulationConstant<N extends SimulationConstantName>(
  name: N
): SimulationConstantRegistry[N] {
  return SIMULATION_CONSTANT_REGISTRY[name];
}
