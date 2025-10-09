import {
  AIR_DENSITY_KG_PER_M3,
  CP_AIR_J_PER_KG_K,
  LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG,
  SECONDS_PER_HOUR
} from './simConstants.ts';

/**
 * Conversion factor from watt-hours to joules.
 */
export const WATT_HOUR_TO_JOULE = SECONDS_PER_HOUR;

/**
 * Conversion factor from joules to watt-hours.
 */
export const JOULE_TO_WATT_HOUR = 1 / WATT_HOUR_TO_JOULE;

export {
  AIR_DENSITY_KG_PER_M3,
  CP_AIR_J_PER_KG_K,
  LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG
};
