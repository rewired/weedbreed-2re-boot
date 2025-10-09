/** Number of nanoseconds in one wall-clock second. */
export const PERF_BUDGET_NS_PER_SECOND = 1_000_000_000 as const;

/** Number of seconds in a wall-clock minute. */
export const PERF_BUDGET_SECONDS_PER_MINUTE = 60 as const;

/** Default tick sample count used by the CI perf harness. */
export const PERF_BUDGET_CI_TICK_COUNT = 10_000 as const;

/** Minimum ticks-per-minute throughput enforced in CI perf runs. */
export const PERF_BUDGET_MIN_TICKS_PER_MINUTE = 5_000 as const;

/** Heap usage ceiling, expressed in MiB, enforced during perf runs. */
export const PERF_BUDGET_MAX_HEAP_MEBIBYTES = 64 as const;

/** Guard band used when emitting throughput/heap warnings. */
export const PERF_BUDGET_WARNING_GUARD_BAND_01 = 0.05 as const;

/** Maximum average ms/tick budget for the baseline perf scenario. */
export const PERF_BUDGET_BASELINE_MAX_AVG_DURATION_MS = 0.2 as const;

/** Maximum average ms/tick budget for the target perf scenario. */
export const PERF_BUDGET_TARGET_MAX_AVG_DURATION_MS = 0.4 as const;
