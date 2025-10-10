/**
 * Performance harness tuning constants governing the baseline and target scenarios.
 */
export const PERF_HARNESS_COOL_AIR_DUTY01 = 0.8 as const;

/** Duty cycle applied to the veg lighting fixture within the perf harness. */
export const PERF_HARNESS_LED_VEG_LIGHT_DUTY01 = 0.75 as const;

/** Duty cycle applied to the exhaust fan within the perf harness. */
export const PERF_HARNESS_EXHAUST_FAN_DUTY01 = 0.9 as const;

/** Fallback device quality applied when a blueprint omits explicit ratings. */
export const PERF_HARNESS_DEVICE_QUALITY_BASELINE01 = 0.85 as const;

/** Duty cycle applied to passive filtration that runs continuously in perf scenarios. */
export const PERF_HARNESS_CARBON_FILTER_DUTY01 = 1 as const;

/** Default maintenance interval in days when blueprint data is absent. */
export const PERF_HARNESS_MAINTENANCE_INTERVAL_DAYS = 90 as const;

/** Default device lifetime used by the perf harness for missing blueprint data. */
export const PERF_HARNESS_DEVICE_LIFETIME_HOURS = 8_760 as const;

/** Condition threshold that triggers maintenance recommendations in perf runs. */
export const PERF_HARNESS_MAINTENANCE_THRESHOLD01 = 0.4 as const;

/** Condition restoration applied after a maintenance visit during perf runs. */
export const PERF_HARNESS_MAINTENANCE_RESTORE01 = 0.3 as const;

/** Fallback efficiency applied when blueprints do not specify a rating. */
export const PERF_HARNESS_DEVICE_EFFICIENCY_BASELINE01 = 0.75 as const;

/** Default hours allocated for a maintenance service visit when data is missing. */
export const PERF_HARNESS_MAINTENANCE_SERVICE_HOURS = 1 as const;

/** Number of cloned grow zones created in the target perf scenario. */
export const PERF_HARNESS_ZONE_CLONE_COUNT = 5 as const;
