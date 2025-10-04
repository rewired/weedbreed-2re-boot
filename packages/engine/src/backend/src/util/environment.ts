/**
 * Environment-related numeric helpers.
 */
export function resolveAirflow(value: number | undefined): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
}

export function resolveAirMassKg(value: number | undefined): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
}
