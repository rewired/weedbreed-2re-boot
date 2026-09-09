import { describe, expect, it } from 'vitest';

import {
  canonicalStringifyStateHash,
  hashCanonicalState,
  STATE_HASH_NUMERIC_TOLERANCES,
} from '../../../src/backend/src/util/canonicalStateHash.ts';

describe('SEC canonical state hashing', () => {
  it('is independent of object key insertion order', () => {
    expect(hashCanonicalState({ b: 2, nested: { y: false, x: true }, a: 1 }))
      .toBe(hashCanonicalState({ nested: { x: true, y: false }, a: 1, b: 2 }));
  });

  it('normalises negative zero and numeric drift below the absolute tolerance', () => {
    expect(canonicalStringifyStateHash({ zero: -0, value: 1 + 0.4e-9 }))
      .toBe(canonicalStringifyStateHash({ value: 1, zero: 0 }));
    expect(STATE_HASH_NUMERIC_TOLERANCES).toEqual({ absolute: 1e-9, relative: 1e-6 });
  });

  it('survives a JSON export/import without changing identity', () => {
    const state = { amount: 12.1234567894, ordered: [{ id: 'b' }, { id: 'a' }] };
    const imported = JSON.parse(JSON.stringify(state)) as unknown;
    expect(hashCanonicalState(imported)).toBe(hashCanonicalState(state));
  });

  it('rejects non-finite numeric state', () => {
    expect(() => hashCanonicalState({ invalid: Number.POSITIVE_INFINITY }))
      .toThrow('finite numbers');
  });
});
