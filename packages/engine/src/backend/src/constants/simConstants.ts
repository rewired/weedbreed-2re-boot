/**
 * Canonical simulation constants mandated by the Simulation Engine Contract (SEC v0.2.1).
 *
 * @see https://github.com/rewired/weedbreed-2re-boot/docs/SEC.md
 */
export interface SimulationConstants {
  /**
   * Minimal calculable surface area that spatial calculations must respect.
   *
   * The SEC uses this quantum when rounding grow areas, capacity allocations,
   * and surface-dependent device effects.
   */
  readonly AREA_QUANTUM_M2: number;
  /**
   * Canonical grid resolution for light schedule photoperiod definitions,
   * expressed in in-game hours.
   */
  readonly LIGHT_SCHEDULE_GRID_HOURS: number;
  /**
   * Number of seconds contained within a single in-game hour.
   */
  readonly SECONDS_PER_HOUR: number;
  /**
   * Default room interior height in metres whenever a blueprint does not
   * provide an explicit override.
   */
  readonly ROOM_DEFAULT_HEIGHT_M: number;
  /**
   * Specific heat capacity of dry air at constant pressure, expressed in
   * joules per kilogram and kelvin.
   */
  readonly CP_AIR_J_PER_KG_K: number;
  /**
   * Latent heat of vaporisation for water at standard atmospheric pressure,
   * expressed in joules per kilogram.
   */
  readonly LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG: number;
  /**
   * Density of dry air at standard conditions, expressed in kilograms per
   * cubic metre.
   */
  readonly AIR_DENSITY_KG_PER_M3: number;
  /**
   * Baseline ambient CO₂ concentration used when a zone lacks explicit state,
   * expressed in parts per million.
   */
  readonly AMBIENT_CO2_PPM: number;
  /**
   * Hard safety ceiling for in-zone CO₂ concentration expressed in parts per
   * million. Device effects and environment updates must clamp to this value
   * to keep atmospheres within occupational safety bounds.
   */
  readonly SAFETY_MAX_CO2_PPM: number;
  /**
   * Number of in-game hours contained in a single simulation tick.
   */
  readonly HOURS_PER_TICK: number;
  /**
   * Number of in-game hours per day.
   */
  readonly HOURS_PER_DAY: number;
  /**
   * Number of in-game days per calendar month.
   */
  readonly DAYS_PER_MONTH: number;
  /**
   * Number of in-game months per calendar year.
   */
  readonly MONTHS_PER_YEAR: number;
  /**
   * Convenience derived constant expressing the number of hours in an
   * in-game month.
   */
  readonly HOURS_PER_MONTH: number;
  /**
   * Convenience derived constant expressing the number of hours in an
   * in-game year.
   */
  readonly HOURS_PER_YEAR: number;
  /**
   * Acceptable floating point tolerance when comparing values that should be
   * exact within the simulation.
   */
  readonly FLOAT_TOLERANCE: number;
  /**
   * Relative comparison tolerance used for golden master verification and
   * other deterministic hash comparisons.
   */
  readonly EPS_REL: number;
  /**
   * Absolute comparison tolerance paired with {@link EPS_REL} when validating
   * floating point series against golden references.
   */
  readonly EPS_ABS: number;
  /**
   * Number of bytes contained within a single mebibyte (2^20). Utilised by
   * performance budgeting logic and memory diagnostics.
   */
  readonly BYTES_PER_MEBIBYTE: number;
  /**
   * Default truncation length, in hexadecimal characters, for deterministic
   * hash keys derived from SHA-256 digests.
   */
  readonly HASH_KEY_BYTES: number;
  /**
   * Default truncation length, in hexadecimal characters, for summary hashes
   * emitted by golden master fixtures.
   */
  readonly HASH_TRUNC_BYTES: number;
  /**
   * Default longitude (decimal degrees) for company headquarters metadata
   * until the UI allows customisation.
   */
  readonly DEFAULT_COMPANY_LOCATION_LON: number;
  /**
   * Default latitude (decimal degrees) for company headquarters metadata
   * until the UI allows customisation.
   */
  readonly DEFAULT_COMPANY_LOCATION_LAT: number;
  /**
   * Minimal canonical longitude expressed in decimal degrees.
   */
  readonly LONGITUDE_MIN_DEG: number;
  /**
   * Maximal canonical longitude expressed in decimal degrees.
   */
  readonly LONGITUDE_MAX_DEG: number;
  /**
   * Minimal canonical latitude expressed in decimal degrees.
   */
  readonly LATITUDE_MIN_DEG: number;
  /**
   * Maximal canonical latitude expressed in decimal degrees.
   */
  readonly LATITUDE_MAX_DEG: number;
  /**
   * Default city name used for company headquarters metadata.
   */
  readonly DEFAULT_COMPANY_LOCATION_CITY: string;
  /**
   * Default country name used for company headquarters metadata.
   */
  readonly DEFAULT_COMPANY_LOCATION_COUNTRY: string;
  /**
   * Base yield per square meter for harvest calculations.
   */
  readonly BASE_YIELD_PER_M2_KG: number;
  /**
   * Screen-of-green cultivation method yield modifier.
   */
  readonly SCREEN_OF_GREEN_YIELD_MODIFIER: number;
  /**
   * Minimum yield variation factor.
   */
  readonly MIN_YIELD_VARIATION: number;
  /**
   * Maximum yield variation factor.
   */
  readonly MAX_YIELD_VARIATION: number;
  /**
   * Maximum age modifier reduction factor.
   */
  readonly MAX_AGE_MODIFIER_REDUCTION: number;
  /**
   * Age modifier per cycle factor.
   */
  readonly AGE_MODIFIER_PER_CYCLE: number;
  /**
   * Default trait strength minimum.
   */
  readonly DEFAULT_TRAIT_STRENGTH_MIN: number;
  /**
   * Default trait strength maximum.
   */
  readonly DEFAULT_TRAIT_STRENGTH_MAX: number;
  /**
   * Green thumb trait strength minimum.
   */
  readonly GREEN_THUMB_TRAIT_STRENGTH_MIN: number;
  /**
   * Green thumb trait strength maximum.
   */
  readonly GREEN_THUMB_TRAIT_STRENGTH_MAX: number;
  /**
   * Green thumb task duration multiplier factor.
   */
  readonly GREEN_THUMB_TASK_DURATION_FACTOR: number;
  /**
   * Green thumb task error delta factor.
   */
  readonly GREEN_THUMB_TASK_ERROR_FACTOR: number;
  /**
   * Green thumb XP rate multiplier factor.
   */
  readonly GREEN_THUMB_XP_RATE_FACTOR: number;
  /**
   * Night owl trait strength minimum.
   */
  readonly NIGHT_OWL_TRAIT_STRENGTH_MIN: number;
  /**
   * Night owl trait strength maximum.
   */
  readonly NIGHT_OWL_TRAIT_STRENGTH_MAX: number;
  /**
   * Night owl task duration factor.
   */
  readonly NIGHT_OWL_TASK_DURATION_FACTOR: number;
  /**
   * Night owl fatigue factor.
   */
  readonly NIGHT_OWL_FATIGUE_FACTOR: number;
  /**
   * Night owl morale delta factor.
   */
  readonly NIGHT_OWL_MORALE_FACTOR: number;
  /**
   * Night owl start hour.
   */
  readonly NIGHT_OWL_START_HOUR: number;
  /**
   * Night owl end hour.
   */
  readonly NIGHT_OWL_END_HOUR: number;
  /**
   * Quick learner trait strength minimum.
   */
  readonly QUICK_LEARNER_TRAIT_STRENGTH_MIN: number;
  /**
   * Quick learner trait strength maximum.
   */
  readonly QUICK_LEARNER_TRAIT_STRENGTH_MAX: number;
  /**
   * Quick learner XP rate multiplier.
   */
  readonly QUICK_LEARNER_XP_RATE_MULTIPLIER: number;
  /**
   * Optimist morale delta.
   */
  readonly OPTIMIST_MORALE_DELTA: number;
  /**
   * Gearhead trait strength minimum.
   */
  readonly GEARHEAD_TRAIT_STRENGTH_MIN: number;
  /**
   * Gearhead trait strength maximum.
   */
  readonly GEARHEAD_TRAIT_STRENGTH_MAX: number;
  /**
   * Gearhead device wear factor.
   */
  readonly GEARHEAD_DEVICE_WEAR_FACTOR: number;
  /**
   * Gearhead task error factor.
   */
  readonly GEARHEAD_TASK_ERROR_FACTOR: number;
  /**
   * Frugal salary reduction minimum.
   */
  readonly FRUGAL_SALARY_REDUCTION_MIN: number;
  /**
   * Frugal salary reduction factor.
   */
  readonly FRUGAL_SALARY_REDUCTION_FACTOR: number;
  /**
   * Meticulous task error factor when skill applies.
   */
  readonly METICULOUS_TASK_ERROR_FACTOR_SKILL: number;
  /**
   * Meticulous task error factor when skill doesn't apply.
   */
  readonly METICULOUS_TASK_ERROR_FACTOR_NO_SKILL: number;
  /**
   * Meticulous fatigue factor.
   */
  readonly METICULOUS_FATIGUE_FACTOR: number;
  /**
   * Clumsy task error factor.
   */
  readonly CLUMSY_TASK_ERROR_FACTOR: number;
  /**
   * Clumsy device wear factor.
   */
  readonly CLUMSY_DEVICE_WEAR_FACTOR: number;
  /**
   * Slacker task duration factor.
   */
  readonly SLACKER_TASK_DURATION_FACTOR: number;
  /**
   * Slacker fatigue factor.
   */
  readonly SLACKER_FATIGUE_FACTOR: number;
  /**
   * Slacker XP rate factor.
   */
  readonly SLACKER_XP_RATE_FACTOR: number;
  /**
   * Pessimist morale delta.
   */
  readonly PESSIMIST_MORALE_DELTA: number;
  /**
   * Forgetful task duration factor.
   */
  readonly FORGETFUL_TASK_DURATION_FACTOR: number;
  /**
   * Forgetful task error factor.
   */
  readonly FORGETFUL_TASK_ERROR_FACTOR: number;
  /**
   * Demanding salary premium minimum.
   */
  readonly DEMANDING_SALARY_PREMIUM_MIN: number;
  /**
   * Demanding salary premium factor.
   */
  readonly DEMANDING_SALARY_PREMIUM_FACTOR: number;
  /**
   * Slow learner XP rate multiplier.
   */
  readonly SLOW_LEARNER_XP_RATE_MULTIPLIER: number;
  /**
   * Multiplier clamp minimum.
   */
  readonly MULTIPLIER_CLAMP_MIN: number;
  /**
   * Multiplier clamp maximum.
   */
  readonly MULTIPLIER_CLAMP_MAX: number;
  /**
   * Default employee shift hours.
   */
  readonly DEFAULT_EMPLOYEE_SHIFT_HOURS: number;
  /**
   * Default room height in recipes.
   */
  readonly DEFAULT_RECIPE_ROOM_HEIGHT_M: number;
  /**
   * Default zone floor area in recipes.
   */
  readonly DEFAULT_RECIPE_ZONE_FLOOR_AREA_M2: number;
  /**
   * First harvest day for zone 1.
   */
  readonly ZONE_1_FIRST_HARVEST_DAY: number;
  /**
   * Cycle length days for zone 1.
   */
  readonly ZONE_1_CYCLE_LENGTH_DAYS: number;
  /**
   * First harvest day for zone 2.
   */
  readonly ZONE_2_FIRST_HARVEST_DAY: number;
  /**
   * Cycle length days for zone 2.
   */
  readonly ZONE_2_CYCLE_LENGTH_DAYS: number;
  /**
   * First harvest day for zone 3.
   */
  readonly ZONE_3_FIRST_HARVEST_DAY: number;
  /**
   * Cycle length days for zone 3.
   */
  readonly ZONE_3_CYCLE_LENGTH_DAYS: number;
  /**
   * First harvest day for zone 4.
   */
  readonly ZONE_4_FIRST_HARVEST_DAY: number;
  /**
   * Cycle length days for zone 4.
   */
  readonly ZONE_4_CYCLE_LENGTH_DAYS: number;
  /**
   * First harvest day for zone 5.
   */
  readonly ZONE_5_FIRST_HARVEST_DAY: number;
  /**
   * Cycle length days for zone 5.
   */
  readonly ZONE_5_CYCLE_LENGTH_DAYS: number;
}

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
 * Default trait strength minimum.
 */
export const DEFAULT_TRAIT_STRENGTH_MIN = 0.35 as const;

/**
 * Default trait strength maximum.
 */
export const DEFAULT_TRAIT_STRENGTH_MAX = 0.75 as const;

/**
 * Green thumb trait strength minimum.
 */
export const GREEN_THUMB_TRAIT_STRENGTH_MIN = 0.45 as const;

/**
 * Green thumb trait strength maximum.
 */
export const GREEN_THUMB_TRAIT_STRENGTH_MAX = 0.8 as const;

/**
 * Green thumb task duration multiplier factor.
 */
export const GREEN_THUMB_TASK_DURATION_FACTOR = 0.18 as const;

/**
 * Green thumb task error delta factor.
 */
export const GREEN_THUMB_TASK_ERROR_FACTOR = 0.03 as const;

/**
 * Green thumb XP rate multiplier factor.
 */
export const GREEN_THUMB_XP_RATE_FACTOR = 0.08 as const;

/**
 * Night owl trait strength minimum.
 */
export const NIGHT_OWL_TRAIT_STRENGTH_MIN = 0.1 as const;

/**
 * Night owl trait strength maximum.
 */
export const NIGHT_OWL_TRAIT_STRENGTH_MAX = 0.2 as const;

/**
 * Night owl task duration factor.
 */
export const NIGHT_OWL_TASK_DURATION_FACTOR = 0.1 as const;

/**
 * Night owl fatigue factor.
 */
export const NIGHT_OWL_FATIGUE_FACTOR = 0.2 as const;

/**
 * Night owl morale delta factor.
 */
export const NIGHT_OWL_MORALE_FACTOR = 0.02 as const;

/**
 * Night owl start hour.
 */
export const NIGHT_OWL_START_HOUR = 20 as const;

/**
 * Night owl end hour.
 */
export const NIGHT_OWL_END_HOUR = 6 as const;

/**
 * Quick learner trait strength minimum.
 */
export const QUICK_LEARNER_TRAIT_STRENGTH_MIN = 0.55 as const;

/**
 * Quick learner trait strength maximum.
 */
export const QUICK_LEARNER_TRAIT_STRENGTH_MAX = 0.85 as const;

/**
 * Quick learner XP rate multiplier.
 */
export const QUICK_LEARNER_XP_RATE_MULTIPLIER = 1.2 as const;

/**
 * Optimist morale delta.
 */
export const OPTIMIST_MORALE_DELTA = 0.03 as const;

/**
 * Gearhead trait strength minimum.
 */
export const GEARHEAD_TRAIT_STRENGTH_MIN = 0.4 as const;

/**
 * Gearhead trait strength maximum.
 */
export const GEARHEAD_TRAIT_STRENGTH_MAX = 0.7 as const;

/**
 * Gearhead device wear factor.
 */
export const GEARHEAD_DEVICE_WEAR_FACTOR = 0.25 as const;

/**
 * Gearhead task error factor.
 */
export const GEARHEAD_TASK_ERROR_FACTOR = 0.02 as const;

/**
 * Frugal salary reduction minimum.
 */
export const FRUGAL_SALARY_REDUCTION_MIN = 0.5 as const;

/**
 * Frugal salary reduction factor.
 */
export const FRUGAL_SALARY_REDUCTION_FACTOR = 0.05 as const;

/**
 * Meticulous task error factor when skill applies.
 */
export const METICULOUS_TASK_ERROR_FACTOR_SKILL = 0.05 as const;

/**
 * Meticulous task error factor when skill doesn't apply.
 */
export const METICULOUS_TASK_ERROR_FACTOR_NO_SKILL = 0.02 as const;

/**
 * Meticulous fatigue factor.
 */
export const METICULOUS_FATIGUE_FACTOR = 0.05 as const;

/**
 * Clumsy task error factor.
 */
export const CLUMSY_TASK_ERROR_FACTOR = 0.06 as const;

/**
 * Clumsy device wear factor.
 */
export const CLUMSY_DEVICE_WEAR_FACTOR = 0.12 as const;

/**
 * Slacker task duration factor.
 */
export const SLACKER_TASK_DURATION_FACTOR = 0.12 as const;

/**
 * Slacker fatigue factor.
 */
export const SLACKER_FATIGUE_FACTOR = 0.18 as const;

/**
 * Slacker XP rate factor.
 */
export const SLACKER_XP_RATE_FACTOR = 0.08 as const;

/**
 * Pessimist morale delta.
 */
export const PESSIMIST_MORALE_DELTA = -0.035 as const;

/**
 * Forgetful task duration factor.
 */
export const FORGETFUL_TASK_DURATION_FACTOR = 0.08 as const;

/**
 * Forgetful task error factor.
 */
export const FORGETFUL_TASK_ERROR_FACTOR = 0.025 as const;

/**
 * Demanding salary premium minimum.
 */
export const DEMANDING_SALARY_PREMIUM_MIN = 1 as const;

/**
 * Demanding salary premium factor.
 */
export const DEMANDING_SALARY_PREMIUM_FACTOR = 0.08 as const;

/**
 * Slow learner XP rate multiplier.
 */
export const SLOW_LEARNER_XP_RATE_MULTIPLIER = 0.82 as const;

/**
 * Multiplier clamp minimum.
 */
export const MULTIPLIER_CLAMP_MIN = 0.25 as const;

/**
 * Multiplier clamp maximum.
 */
export const MULTIPLIER_CLAMP_MAX = 1.75 as const;

/**
 * Default employee shift hours.
 */
export const DEFAULT_EMPLOYEE_SHIFT_HOURS = 8 as const;

/**
 * Default room height in recipes.
 */
export const DEFAULT_RECIPE_ROOM_HEIGHT_M = 3 as const;

/**
 * Default zone floor area in recipes.
 */
export const DEFAULT_RECIPE_ZONE_FLOOR_AREA_M2 = 20 as const;

/**
 * First harvest day for zone 1.
 */
export const ZONE_1_FIRST_HARVEST_DAY = 24 as const;

/**
 * Cycle length days for zone 1.
 */
export const ZONE_1_CYCLE_LENGTH_DAYS = 56 as const;

/**
 * First harvest day for zone 2.
 */
export const ZONE_2_FIRST_HARVEST_DAY = 26 as const;

/**
 * Cycle length days for zone 2.
 */
export const ZONE_2_CYCLE_LENGTH_DAYS = 63 as const;

/**
 * First harvest day for zone 3.
 */
export const ZONE_3_FIRST_HARVEST_DAY = 28 as const;

/**
 * Cycle length days for zone 3.
 */
export const ZONE_3_CYCLE_LENGTH_DAYS = 52 as const;

/**
 * First harvest day for zone 4.
 */
export const ZONE_4_FIRST_HARVEST_DAY = 30 as const;

/**
 * Cycle length days for zone 4.
 */
export const ZONE_4_CYCLE_LENGTH_DAYS = 60 as const;

/**
 * First harvest day for zone 5.
 */
export const ZONE_5_FIRST_HARVEST_DAY = 32 as const;

/**
 * Cycle length days for zone 5.
 */
export const ZONE_5_CYCLE_LENGTH_DAYS = 58 as const;

/**
 * Single source of truth that stores the canonical simulation constants.
 *
 * The registry is frozen once to guarantee immutability and shared between
 * direct imports (`@/backend/src/constants/simConstants`) and the public
 * engine entry point (`@wb/engine`).
 */
const SIMULATION_CONSTANT_REGISTRY = Object.freeze({
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
  DEFAULT_TRAIT_STRENGTH_MIN,
  DEFAULT_TRAIT_STRENGTH_MAX,
  GREEN_THUMB_TRAIT_STRENGTH_MIN,
  GREEN_THUMB_TRAIT_STRENGTH_MAX,
  GREEN_THUMB_TASK_DURATION_FACTOR,
  GREEN_THUMB_TASK_ERROR_FACTOR,
  GREEN_THUMB_XP_RATE_FACTOR,
  NIGHT_OWL_TRAIT_STRENGTH_MIN,
  NIGHT_OWL_TRAIT_STRENGTH_MAX,
  NIGHT_OWL_TASK_DURATION_FACTOR,
  NIGHT_OWL_FATIGUE_FACTOR,
  NIGHT_OWL_MORALE_FACTOR,
  NIGHT_OWL_START_HOUR,
  NIGHT_OWL_END_HOUR,
  QUICK_LEARNER_TRAIT_STRENGTH_MIN,
  QUICK_LEARNER_TRAIT_STRENGTH_MAX,
  QUICK_LEARNER_XP_RATE_MULTIPLIER,
  OPTIMIST_MORALE_DELTA,
  GEARHEAD_TRAIT_STRENGTH_MIN,
  GEARHEAD_TRAIT_STRENGTH_MAX,
  GEARHEAD_DEVICE_WEAR_FACTOR,
  GEARHEAD_TASK_ERROR_FACTOR,
  FRUGAL_SALARY_REDUCTION_MIN,
  FRUGAL_SALARY_REDUCTION_FACTOR,
  METICULOUS_TASK_ERROR_FACTOR_SKILL,
  METICULOUS_TASK_ERROR_FACTOR_NO_SKILL,
  METICULOUS_FATIGUE_FACTOR,
  CLUMSY_TASK_ERROR_FACTOR,
  CLUMSY_DEVICE_WEAR_FACTOR,
  SLACKER_TASK_DURATION_FACTOR,
  SLACKER_FATIGUE_FACTOR,
  SLACKER_XP_RATE_FACTOR,
  PESSIMIST_MORALE_DELTA,
  FORGETFUL_TASK_DURATION_FACTOR,
  FORGETFUL_TASK_ERROR_FACTOR,
  DEMANDING_SALARY_PREMIUM_MIN,
  DEMANDING_SALARY_PREMIUM_FACTOR,
  SLOW_LEARNER_XP_RATE_MULTIPLIER,
  MULTIPLIER_CLAMP_MIN,
  MULTIPLIER_CLAMP_MAX,
  DEFAULT_EMPLOYEE_SHIFT_HOURS,
  DEFAULT_RECIPE_ROOM_HEIGHT_M,
  DEFAULT_RECIPE_ZONE_FLOOR_AREA_M2,
  ZONE_1_FIRST_HARVEST_DAY,
  ZONE_1_CYCLE_LENGTH_DAYS,
  ZONE_2_FIRST_HARVEST_DAY,
  ZONE_2_CYCLE_LENGTH_DAYS,
  ZONE_3_FIRST_HARVEST_DAY,
  ZONE_3_CYCLE_LENGTH_DAYS,
  ZONE_4_FIRST_HARVEST_DAY,
  ZONE_4_CYCLE_LENGTH_DAYS,
  ZONE_5_FIRST_HARVEST_DAY,
  ZONE_5_CYCLE_LENGTH_DAYS
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
