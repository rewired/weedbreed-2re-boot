/**
 * Deterministic pseudo-random number generator aligned with the engine's
 * `createRng` helper so UI modules can avoid `Math.random`.
 */
/* eslint-disable @typescript-eslint/no-magic-numbers -- RNG seeding constants require fixed values */
export type RandomNumberGenerator = () => number;

const UINT32_MAX = 0xffffffff;
const XMUR3_INITIAL_HASH = 1779033703 as const;
const XMUR3_MULTIPLIER_A = 3432918353 as const;
const XMUR3_ROTATE_LEFT_BITS = 13 as const;
const XMUR3_ROTATE_RIGHT_BITS = 19 as const;
const XMUR3_SHIFT_FIRST = 16 as const;
const XMUR3_MULTIPLIER_B = 2246822507 as const;
const XMUR3_SHIFT_SECOND = 13 as const;
const XMUR3_MULTIPLIER_C = 3266489909 as const;
const XMUR3_SHIFT_THIRD = 16 as const;

const MULBERRY32_INCREMENT = 0x6d2b79f5 as const;
const MULBERRY32_SHIFT_FIRST = 15 as const;
const MULBERRY32_SHIFT_SECOND = 7 as const;
const MULBERRY32_SHIFT_THIRD = 14 as const;
const MULBERRY32_OR_MASK = 61 as const;

/**
 * Creates a deterministic pseudo-random number generator scoped to a seed and stream.
 *
 * Mirrors the backend implementation so jitter/backoff logic remains reproducible.
 */
export function createRng(seed: string, streamId: string): RandomNumberGenerator {
  if (!seed) {
    throw new Error("seed must be a non-empty string");
  }

  if (!streamId) {
    throw new Error("streamId must be a non-empty string");
  }

  const combinedSeed = `${seed}:${streamId}`;
  const seedMixer = xmur3(combinedSeed);
  const initialState = seedMixer();

  return mulberry32(initialState);
}

function xmur3(str: string): () => number {
  let h = XMUR3_INITIAL_HASH ^ str.length;

  for (let index = 0; index < str.length; index += 1) {
    h = Math.imul(h ^ str.charCodeAt(index), XMUR3_MULTIPLIER_A);
    h = (h << XMUR3_ROTATE_LEFT_BITS) | (h >>> XMUR3_ROTATE_RIGHT_BITS);
  }

  return () => {
    h = Math.imul(h ^ (h >>> XMUR3_SHIFT_FIRST), XMUR3_MULTIPLIER_B);
    h = Math.imul(h ^ (h >>> XMUR3_SHIFT_SECOND), XMUR3_MULTIPLIER_C);
    h ^= h >>> XMUR3_SHIFT_THIRD;
    return h >>> 0;
  };
}

function mulberry32(seed: number): RandomNumberGenerator {
  let state = seed >>> 0;

  return () => {
    state = (state + MULBERRY32_INCREMENT) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> MULBERRY32_SHIFT_FIRST), t | 1);
    t ^= t + Math.imul(t ^ (t >>> MULBERRY32_SHIFT_SECOND), t | MULBERRY32_OR_MASK);
    return ((t ^ (t >>> MULBERRY32_SHIFT_THIRD)) >>> 0) / (UINT32_MAX + 1);
  };
}

/* eslint-enable @typescript-eslint/no-magic-numbers */
