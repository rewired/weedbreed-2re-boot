/**
 * Canonical horizons for deterministic golden master scenario runs used by the
 * conformance test harness.
 */
export const GM_DAYS_SHORT = 30 as const;

/**
 * Extended horizon for deterministic golden master scenario runs validating
 * longer term behaviour.
 */
export const GM_DAYS_LONG = 200 as const;

/**
 * Readonly tuple of supported golden master horizons.
 */
export const GOLDEN_MASTER_DAY_RUNS = [GM_DAYS_SHORT, GM_DAYS_LONG] as const;

type GoldenMasterRunTuple = typeof GOLDEN_MASTER_DAY_RUNS;

export type GoldenMasterRunDayCount = GoldenMasterRunTuple[number];
