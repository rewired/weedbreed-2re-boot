/**
 * Canonical simulation constants aligned with SEC v0.2.1 (§1.2).
 */
export const AREA_QUANTUM_M2 = 0.25 as const;

/**
 * Default interior height for rooms when no blueprint override is provided (meters).
 */
export const ROOM_DEFAULT_HEIGHT_M = 3 as const;

/**
 * One tick equals one in-game hour; see SEC §1.2.
 */
export const HOURS_PER_TICK = 1 as const;

/**
 * Number of hours in an in-game day.
 */
export const HOURS_PER_DAY = 24 as const;

/**
 * Number of days per in-game month (SEC §1.2).
 */
export const DAYS_PER_MONTH = 30 as const;

/**
 * Number of months per in-game year (SEC §1.2).
 */
export const MONTHS_PER_YEAR = 12 as const;

/**
 * Absolute tolerance for floating point comparisons (SEC §1.5).
 */
export const EPS_ABS = 1e-9 as const;

/**
 * Relative tolerance for floating point comparisons (SEC §1.5).
 */
export const EPS_REL = 1e-6 as const;

/**
 * Ordered tick pipeline phases. Every phase is executed for every tick (SEC §1.1, §1.3).
 */
export const PIPELINE_PHASES = [
  'Initialization',
  'EnvironmentControl',
  'IrrigationAndFeeding',
  'Physiology',
  'Maintenance',
  'HarvestAndProcessing',
  'Economy',
  'Telemetry',
  'Commit',
] as const;

export type PipelinePhase = (typeof PIPELINE_PHASES)[number];
