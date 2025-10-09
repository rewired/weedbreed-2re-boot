import {
  HOURS_PER_DAY,
  HOURS_PER_MONTH,
  HOURS_PER_TICK,
  HOURS_PER_YEAR,
  LIGHT_SCHEDULE_GRID_HOURS,
  SECONDS_PER_HOUR
} from './simConstants.ts';

/**
 * Number of minutes contained in a single hour.
 */
export const MINUTES_PER_HOUR = 60 as const;

/**
 * Number of seconds contained within a single simulation tick.
 */
export const SECONDS_PER_TICK = SECONDS_PER_HOUR * HOURS_PER_TICK;

/**
 * Number of minutes contained within a single simulation tick.
 */
export const MINUTES_PER_TICK = MINUTES_PER_HOUR * HOURS_PER_TICK;

/**
 * Number of simulation ticks contained within a single in-game day.
 */
export const TICKS_PER_DAY = HOURS_PER_DAY / HOURS_PER_TICK;

/**
 * Number of simulation ticks contained within a single in-game month.
 */
export const TICKS_PER_MONTH = HOURS_PER_MONTH / HOURS_PER_TICK;

/**
 * Number of simulation ticks contained within a single in-game year.
 */
export const TICKS_PER_YEAR = HOURS_PER_YEAR / HOURS_PER_TICK;

/**
 * Canonical minutes step mandated by the SEC light schedule grid (15 minutes).
 */
export const MINUTES_STEP = LIGHT_SCHEDULE_GRID_HOURS * MINUTES_PER_HOUR;

export {
  HOURS_PER_DAY,
  HOURS_PER_MONTH,
  HOURS_PER_TICK,
  HOURS_PER_YEAR,
  LIGHT_SCHEDULE_GRID_HOURS,
  SECONDS_PER_HOUR
};
