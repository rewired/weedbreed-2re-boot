import { describe, expect, it } from 'vitest';

import { createRng } from '@/backend/src/util/rng.js';

describe('createRng', () => {
  it('produces identical sequences for the same seed and stream', () => {
    const first = createRng('deterministic-seed', 'stream:quality');
    const second = createRng('deterministic-seed', 'stream:quality');

    const firstSequence = Array.from({ length: 16 }, () => first());
    const secondSequence = Array.from({ length: 16 }, () => second());

    expect(secondSequence).toStrictEqual(firstSequence);
  });

  it('isolates streams so different stream identifiers diverge', () => {
    const baseSeed = 'deterministic-seed';
    const qualityStream = createRng(baseSeed, 'stream:quality');
    const deviceStream = createRng(baseSeed, 'stream:device');

    const qualitySamples = Array.from({ length: 8 }, () => qualityStream());
    const deviceSamples = Array.from({ length: 8 }, () => deviceStream());

    expect(deviceSamples).not.toStrictEqual(qualitySamples);
  });
});
