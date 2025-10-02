import { AIR_DENSITY_KG_PER_M3, CP_AIR_J_PER_KG_K, HOURS_PER_TICK } from '../../constants/simConstants.js';
import type { Zone, ZoneDeviceInstance } from '../../domain/world.js';

const SECONDS_PER_HOUR = 3_600;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function resolveTickHours(tickHours: number | undefined): number {
  if (typeof tickHours !== 'number') {
    return HOURS_PER_TICK;
  }

  if (!Number.isFinite(tickHours) || tickHours <= 0) {
    return HOURS_PER_TICK;
  }

  return tickHours;
}

function resolveAirMassKg(zone: Pick<Zone, 'floorArea_m2' | 'height_m'>): number {
  const volume_m3 = zone.floorArea_m2 * zone.height_m;

  if (!Number.isFinite(volume_m3) || volume_m3 <= 0) {
    return 0;
  }

  return volume_m3 * AIR_DENSITY_KG_PER_M3;
}

/**
 * Converts waste electrical power produced by a device into a sensible heat
 * delta for the hosting zone.
 *
 * @param zone - Zone receiving the sensible heat load.
 * @param device - Device producing the waste heat.
 * @param tickHours - Duration of the simulation tick in hours.
 * @returns Temperature delta in degrees Celsius for the tick duration.
 */
export function applyDeviceHeat(
  zone: Pick<Zone, 'floorArea_m2' | 'height_m'>,
  device: Pick<ZoneDeviceInstance, 'powerDraw_W' | 'dutyCycle01' | 'efficiency01'>,
  tickHours: number = HOURS_PER_TICK
): number {
  const efficiency = device.efficiency01;

  if (!Number.isFinite(efficiency) || efficiency < 0 || efficiency > 1) {
    throw new RangeError('Device efficiency must lie within [0,1].');
  }

  const duty = clamp01(device.dutyCycle01);
  const powerDraw_W = Math.max(0, device.powerDraw_W);
  const resolvedTickHours = resolveTickHours(tickHours);

  if (duty === 0 || powerDraw_W === 0 || resolvedTickHours === 0) {
    return 0;
  }

  const airMassKg = resolveAirMassKg(zone);

  if (airMassKg === 0) {
    return 0;
  }

  const wastePower_W = powerDraw_W * (1 - efficiency) * duty;

  if (wastePower_W <= 0) {
    return 0;
  }

  const joules = wastePower_W * resolvedTickHours * SECONDS_PER_HOUR;
  const deltaK = joules / (airMassKg * CP_AIR_J_PER_KG_K);

  return deltaK;
}
