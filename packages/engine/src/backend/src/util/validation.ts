/**
 * Runtime validation helpers for deterministic engine code.
 */
export function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }

  if (value <= 0) {
    throw new Error(`${name} must be greater than zero.`);
  }
}

export function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }

  if (value < 0) {
    throw new Error(`${name} must be greater than or equal to zero.`);
  }
}

export function ensureFraction01(
  value: number | undefined,
  fallback: number,
  name: string
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }

  if (value < 0 || value > 1) {
    throw new Error(`${name} must lie within [0,1].`);
  }

  return value;
}
