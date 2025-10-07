import { describe, expect, it } from 'vitest';

import { createRng } from '@/backend/src/util/rng.js';

const SEQUENCE_LENGTH = 16;
const SAMPLE_LENGTH = 8;

describe('createRng', () => {
  it('produces identical sequences for the same seed and stream', () => {
    const first = createRng('deterministic-seed', 'stream:quality');
    const second = createRng('deterministic-seed', 'stream:quality');

    const firstSequence = Array.from({ length: SEQUENCE_LENGTH }, () => first());
    const secondSequence = Array.from({ length: SEQUENCE_LENGTH }, () => second());

    expect(secondSequence).toStrictEqual(firstSequence);
  });

  it('isolates streams so different stream identifiers diverge', () => {
    const baseSeed = 'deterministic-seed';
    const qualityStream = createRng(baseSeed, 'stream:quality');
    const deviceStream = createRng(baseSeed, 'stream:device');

    const qualitySamples = Array.from({ length: SAMPLE_LENGTH }, () => qualityStream());
    const deviceSamples = Array.from({ length: SAMPLE_LENGTH }, () => deviceStream());

    expect(deviceSamples).not.toStrictEqual(qualitySamples);
  });
});
