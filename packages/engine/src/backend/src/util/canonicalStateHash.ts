import { createHash } from 'node:crypto';

import safeStringify from 'safe-stable-stringify';

import { EPS_ABS, EPS_REL, STATE_HASH_DECIMAL_PLACES } from '../constants/simConstants.ts';

export { STATE_HASH_DECIMAL_PLACES } from '../constants/simConstants.ts';

/**
 * Normalises a finite number for canonical state hashing.
 *
 * State identity is quantised to {@link EPS_ABS} (`1e-9`) and negative zero is
 * represented as zero. {@link EPS_REL} remains the tolerance for numeric
 * conformance assertions; it is deliberately not magnitude-dependent here so
 * one state always has one canonical byte representation.
 */
export function canonicaliseStateHashNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError('Canonical state hashes only support finite numbers.');
  }

  const rounded = Number(value.toFixed(STATE_HASH_DECIMAL_PLACES));
  return Object.is(rounded, -0) || Math.abs(rounded) < EPS_ABS ? 0 : rounded;
}

/** Recursively normalises numeric leaves while preserving authoritative array order. */
export function canonicaliseStateHashValue(value: unknown): unknown {
  if (typeof value === 'number') return canonicaliseStateHashNumber(value);
  if (Array.isArray(value)) return value.map(canonicaliseStateHashValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .map(([key, nested]) => [key, canonicaliseStateHashValue(nested)]),
    );
  }
  return value;
}

/** Produces canonical JSON for persistent state and conformance evidence. */
export function canonicalStringifyStateHash(value: unknown): string {
  const canonical = safeStringify(canonicaliseStateHashValue(value));
  if (canonical === undefined) throw new TypeError('Value could not be canonicalised for state hashing.');
  return canonical;
}

/** Produces a full SHA-256 digest of canonical persistent state. */
export function hashCanonicalState(value: unknown): string {
  return createHash('sha256').update(canonicalStringifyStateHash(value)).digest('hex');
}

/** Published numeric hash contract for diagnostics and documentation. */
export const STATE_HASH_NUMERIC_TOLERANCES = { absolute: EPS_ABS, relative: EPS_REL } as const;
