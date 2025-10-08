import { describe, expect, it } from 'vitest';

import { newV7 } from '../../../../src/shared/determinism/ids.ts';

describe('newV7', () => {
  const uuidV7Pattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

  it('generates uuid v7 identifiers', () => {
    const id = newV7();
    expect(id).toMatch(uuidV7Pattern);
  });

  it('produces low collision risk across short bursts', () => {
    const samples = Array.from({ length: 16 }, () => newV7());
    const unique = new Set(samples);
    expect(unique.size).toBe(samples.length);
  });
});
