/**
 * Shared test fixture constants used across engine unit and integration tests.
 *
 * Centralising these values keeps eslint's `no-magic-numbers` rule satisfied
 * without obscuring the intent of each test case.
 */
export const TRAIT_SAMPLE_RNG_SEQUENCE = [0.2, 0.8, 0.1, 0.7, 0.6] as const;

/**
 * Fallback RNG value used when the sampling sequence underflows during tests.
 */
export const TRAIT_SAMPLE_RNG_FALLBACK = 0.3 as const;

/**
 * Representative trait strength values covering low/medium/high intensities.
 */
export const TRAIT_STRENGTH_LOW01 = 0.4 as const;
export const TRAIT_STRENGTH_MEDIUM01 = 0.5 as const;
export const TRAIT_STRENGTH_HIGH01 = 0.6 as const;
export const TRAIT_STRENGTH_VERY_HIGH01 = 0.7 as const;
export const TRAIT_STRENGTH_PEAK01 = 0.8 as const;
export const TRAIT_STRENGTH_ASSIGNMENT01 = 0.95 as const;

/** Precision used when asserting floating point trait adjustments. */
export const TRAIT_DURATION_PRECISION_DIGITS = 5 as const;

/** Baseline task parameters referenced by workforce trait tests. */
export const TEST_TASK_DURATION_MINUTES = 120 as const;
export const TEST_TASK_PRIORITY_HIGH = 10 as const;
export const TEST_FATIGUE_DELTA = 0.4 as const;
export const TEST_MORALE_DELTA = -0.05 as const;
export const TEST_NIGHT_SHIFT_HOUR = 22 as const;
export const TEST_REQUIRED_SKILL_MIN01 = 0.4 as const;
export const TEST_SALARY_EXPECTATION_PER_H = 25 as const;
export const TRAIT_GREEN_THUMB_MULTIPLIER_BASE = 0.18 as const;

/** Salary computation parameters used by workforce market fixtures. */
export const WORKFORCE_BASE_SALARY_OFFSET_PER_H = 5 as const;
export const WORKFORCE_BASE_SALARY_MULTIPLIER = 10 as const;

/**
 * Psychrometric reference values derived from SEC documentation and
 * cross-checked against golden fixtures.
 */
export const PSYCHRO_REFERENCE_TEMP_C = 25 as const;
export const PSYCHRO_REFERENCE_HUMIDITY01 = 0.5 as const;
export const PSYCHRO_REFERENCE_VPD_KPA = 1.5839 as const;
export const PSYCHRO_PRECISION_DIGITS = 4 as const;
export const PSYCHRO_MIN_TEMP_C = -40 as const;
export const PSYCHRO_MAX_TEMP_C = 60 as const;

/** Deterministic ID sampling parameters. */
export const DETERMINISTIC_ID_SAMPLE_COUNT = 16 as const;

/** Canonical SEC values validated in sim constants tests. */
export const SEC_LIGHT_SCHEDULE_GRID_HOURS = 0.25 as const;
export const SEC_ROOM_DEFAULT_HEIGHT_M = 3 as const;
export const SEC_CP_AIR_J_PER_KG_K = 1_005 as const;
export const SEC_AIR_DENSITY_KG_PER_M3 = 1.2041 as const;
export const SEC_HOURS_PER_DAY = 24 as const;
export const SEC_DAYS_PER_MONTH = 30 as const;
export const SEC_MONTHS_PER_YEAR = 12 as const;
export const SIM_TOLERANCE_MOCK = 0.5 as const;
export const SIM_MOCKED_CO2_LIMIT_PPM = 1_234 as const;
export const SIM_DEW_POINT_REFERENCE_TEMP_C = 20 as const;
