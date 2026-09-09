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
  /** Decimal places retained by canonical persistent-state hashes. */
  readonly STATE_HASH_DECIMAL_PLACES: number;
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
  /**
   * Minimum base rate multiplier.
   */
  readonly MIN_BASE_RATE_MULTIPLIER: number;
  /**
   * Maximum base rate multiplier.
   */
  readonly MAX_BASE_RATE_MULTIPLIER: number;
  /**
   * Minimum hours per day for employee schedule.
   */
  readonly MIN_HOURS_PER_DAY: number;
  /**
   * Maximum hours per day for employee schedule.
   */
  readonly MAX_HOURS_PER_DAY: number;
  /**
   * Maximum overtime hours per day.
   */
  readonly MAX_OVERTIME_HOURS_PER_DAY: number;
  /**
   * Maximum days per week.
   */
  readonly MAX_DAYS_PER_WEEK: number;
  /**
   * Minimum labor market factor.
   */
  readonly MIN_LABOR_MARKET_FACTOR: number;
  /**
   * Maximum labor market factor.
   */
  readonly MAX_LABOR_MARKET_FACTOR: number;
  /**
   * Minimum time premium multiplier.
   */
  readonly MIN_TIME_PREMIUM_MULTIPLIER: number;
  /**
   * Maximum time premium multiplier.
   */
  readonly MAX_TIME_PREMIUM_MULTIPLIER: number;
  /**
   * Minimum main skill value.
   */
  readonly MIN_MAIN_SKILL_VALUE: number;
  /**
   * Maximum main skill value.
   */
  readonly MAX_MAIN_SKILL_VALUE: number;
  /**
   * Minimum secondary skill value.
   */
  readonly MIN_SECONDARY_SKILL_VALUE: number;
  /**
   * Maximum secondary skill value.
   */
  readonly MAX_SECONDARY_SKILL_VALUE: number;
  /**
   * Minimum trait strength.
   */
  readonly MIN_TRAIT_STRENGTH: number;
  /**
   * Maximum trait strength.
   */
  readonly MAX_TRAIT_STRENGTH: number;
  /**
   * Default dry matter fraction.
   */
  readonly DEFAULT_DRY_MATTER_FRACTION: number;
  /**
   * Default harvest index.
   */
  readonly DEFAULT_HARVEST_INDEX: number;
  /**
   * Seedling phase multiplier.
   */
  readonly SEEDLING_PHASE_MULTIPLIER: number;
  /**
   * Vegetative phase multiplier.
   */
  readonly VEGETATIVE_PHASE_MULTIPLIER: number;
  /**
   * Flowering phase multiplier.
   */
  readonly FLOWERING_PHASE_MULTIPLIER: number;
  /**
   * Harvest ready phase multiplier.
   */
  readonly HARVEST_READY_PHASE_MULTIPLIER: number;
  /**
   * Temperature factor divisor for Q10 calculation.
   */
  readonly Q10_TEMPERATURE_DIVISOR: number;
  /**
   * Temperature factor clamp maximum.
   */
  readonly TEMPERATURE_FACTOR_CLAMP_MAX: number;
  /**
   * Extreme temperature factor reduction.
   */
  readonly EXTREME_TEMPERATURE_FACTOR: number;
  /**
   * Grams per kilogram conversion factor.
   */
  readonly GRAMS_PER_KILOGRAM: number;
  /**
   * Noise factor for biomass calculation.
   */
  readonly NOISE_FACTOR: number;
  /**
   * Health decay rate per hour.
   */
  readonly HEALTH_DECAY_RATE_PER_HOUR: number;
  /**
   * Health variation minimum.
   */
  readonly HEALTH_VARIATION_MIN: number;
  /**
   * Health variation range.
   */
  readonly HEALTH_VARIATION_RANGE: number;
  /**
   * Health recovery stress threshold.
   */
  readonly HEALTH_RECOVERY_STRESS_THRESHOLD: number;
  /**
   * Health recovery rate per hour.
   */
  readonly HEALTH_RECOVERY_RATE_PER_HOUR: number;
  /**
   * Harvest quality health weight.
   */
  readonly HARVEST_QUALITY_HEALTH_WEIGHT: number;
  /**
   * Harvest quality stress weight.
   */
  readonly HARVEST_QUALITY_STRESS_WEIGHT: number;
  /**
   * Harvest quality genetic weight.
   */
  readonly HARVEST_QUALITY_GENETIC_WEIGHT: number;
  /**
   * Harvest quality high threshold.
   */
  readonly HARVEST_QUALITY_HIGH_THRESHOLD: number;
  /**
   * Harvest quality high bonus factor.
   */
  readonly HARVEST_QUALITY_HIGH_BONUS_FACTOR: number;
  /**
   * Milliseconds per second conversion factor.
   */
  readonly MILLISECONDS_PER_SECOND: number;
}
