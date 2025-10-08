/**
 * Environment-related numeric helpers.
 */

function coercePositiveFiniteNumber(candidate: unknown): number | null {
  if (typeof candidate === 'number') {
    return Number.isFinite(candidate) ? candidate : null;
  }

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();

    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number.parseFloat(trimmed);

    if (Number.isFinite(parsed)) {
      return parsed;
    }

    return null;
  }

  return null;
}

function resolvePositiveFinite(candidate: unknown): number {
  const numericValue = coercePositiveFiniteNumber(candidate);

  if (numericValue === null || numericValue <= 0) {
    return 0;
  }

  return numericValue;
}

export function resolveAirflow(value: unknown): number {
  return resolvePositiveFinite(value);
}

export function resolveAirMassKg(value: unknown): number {
  return resolvePositiveFinite(value);
}
