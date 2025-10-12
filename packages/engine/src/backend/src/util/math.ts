/**
 * Numeric helper utilities shared across the simulation engine.
 */
/* eslint-disable @typescript-eslint/no-magic-numbers -- Banker's rounding uses 0.5 thresholds */
const HALF = 0.5 as const;
/* eslint-enable @typescript-eslint/no-magic-numbers */

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    if (value === Number.POSITIVE_INFINITY) {
      return max === Number.POSITIVE_INFINITY ? value : max;
    }

    if (value === Number.NEGATIVE_INFINITY) {
      return min === Number.NEGATIVE_INFINITY ? value : min;
    }

    return min;
  }

  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

/**
 * Clamps a numeric value to the inclusive [0,1] interval.
 */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/**
 * Applies Banker's rounding (round half to even) to the given numeric value.
 */
export function bankersRound(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) {
    return Number.isNaN(value) ? Number.NaN : value;
  }

  const factor = 10 ** Math.max(0, Math.trunc(decimals));
  const scaled = value * factor;
  const floorValue = Math.floor(scaled);
  const diff = scaled - floorValue;
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(scaled));

  if (Math.abs(diff - HALF) <= epsilon) {
    const isEven = Math.abs(floorValue) % 2 === 0;
    const evenValue = isEven ? floorValue : floorValue + Math.sign(scaled || 1);
    return evenValue / factor;
  }

  if (diff < HALF) {
    return floorValue / factor;
  }

  return Math.ceil(scaled) / factor;
}
