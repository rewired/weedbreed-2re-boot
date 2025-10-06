import { createHash } from 'node:crypto';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Canonically stringifies JSON by sorting object keys recursively.
 */
export function canonicalStringify(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${canonicalStringify(val)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

/**
 * Produces a SHA-256 hash over the canonical JSON representation.
 */
export function hashCanonical(value: JsonValue): string {
  return createHash('sha256').update(canonicalStringify(value)).digest('hex');
}
