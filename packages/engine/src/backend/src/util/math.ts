/**
 * Numeric helper utilities shared across the simulation engine.
 */
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
