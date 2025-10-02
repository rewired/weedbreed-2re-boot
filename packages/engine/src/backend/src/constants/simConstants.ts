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
   * Default room interior height in metres whenever a blueprint does not
   * provide an explicit override.
   */
  readonly ROOM_DEFAULT_HEIGHT_M: number;
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
 * Canonical constant describing the default height of a room interior,
 * expressed in metres.
 */
export const ROOM_DEFAULT_HEIGHT_M = 3 as const;

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
 * Frozen object literal bundling all canonical simulation constants for
 * ergonomic bulk imports.
 */
export const SIM_CONSTANTS: Readonly<SimulationConstants> = Object.freeze({
  AREA_QUANTUM_M2,
  LIGHT_SCHEDULE_GRID_HOURS,
  ROOM_DEFAULT_HEIGHT_M,
  HOURS_PER_TICK,
  HOURS_PER_DAY,
  DAYS_PER_MONTH,
  MONTHS_PER_YEAR,
  HOURS_PER_MONTH,
  HOURS_PER_YEAR
});

/**
 * Exhaustive list of valid simulation constant identifiers.
 */
export type SimulationConstantName = keyof SimulationConstants;

/**
 * Returns the canonical value for a simulation constant by its identifier.
 *
 * @param name - Identifier of the canonical simulation constant.
 * @returns The canonical value associated with {@link name}.
 */
export function getSimulationConstant(
  name: SimulationConstantName
): number {
  return SIM_CONSTANTS[name];
}
