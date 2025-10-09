/**
 * Workforce market tuning constants governing candidate generation and salary baselines.
 */
export const WORKFORCE_MARKET_MAX_FALLBACK_SKILL_COUNT = 5 as const;

/** Baseline value assigned to a candidate's primary skill when sampling. */
export const WORKFORCE_MARKET_PRIMARY_SKILL_BASELINE01 = 0.25 as const;

/** Width of the sampling range applied to the primary skill baseline. */
export const WORKFORCE_MARKET_PRIMARY_SKILL_RANGE01 = 0.25 as const;

/** Baseline value assigned to each secondary skill during sampling. */
export const WORKFORCE_MARKET_SECONDARY_SKILL_BASELINE01 = 0.01 as const;

/** Width of the sampling range applied to secondary skills. */
export const WORKFORCE_MARKET_SECONDARY_SKILL_RANGE01 = 0.34 as const;

/** Base hourly wage floor applied before trait-driven salary modifiers. */
export const WORKFORCE_MARKET_BASE_SALARY_OFFSET_PER_H = 5 as const;

/** Multiplier translating primary skill strength to wage expectations. */
export const WORKFORCE_MARKET_BASE_SALARY_MULTIPLIER = 10 as const;
