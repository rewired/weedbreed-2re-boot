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
  DEFAULT_COMPANY_LOCATION_LON,
  DEFAULT_COMPANY_LOCATION_LAT,
  LONGITUDE_MIN_DEG,
  LONGITUDE_MAX_DEG,
  LATITUDE_MIN_DEG,
  LATITUDE_MAX_DEG,
  DEFAULT_COMPANY_LOCATION_CITY,
  DEFAULT_COMPANY_LOCATION_COUNTRY
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
