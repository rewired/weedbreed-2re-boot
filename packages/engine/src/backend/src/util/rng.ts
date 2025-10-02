/**
 * Describes the shape of the deterministic pseudo-random number generator.
 */
export type RandomNumberGenerator = () => number;

const UINT32_MAX = 0xffffffff;

/**
 * Creates a deterministic pseudo-random number generator scoped to a seed and stream.
 *
 * The implementation uses the xmur3 string mixer to expand the inputs into a 32-bit
 * seed and feeds that into the mulberry32 generator. The generator is pure and will
 * always emit the same sequence for identical `{seed, streamId}` pairs.
 *
 * @param seed - Shared simulation seed applied to all RNG streams.
 * @param streamId - Stream identifier (e.g. `device:<uuid>`) that isolates RNG state.
 * @returns A function that returns a reproducible floating-point number in the range [0, 1).
 */
export function createRng(seed: string, streamId: string): RandomNumberGenerator {
  if (!seed) {
    throw new Error('seed must be a non-empty string');
  }

  if (!streamId) {
    throw new Error('streamId must be a non-empty string');
  }

  const combinedSeed = `${seed}:${streamId}`;
  const seedMixer = xmur3(combinedSeed);
  const initialState = seedMixer();

  return mulberry32(initialState);
}

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;

  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): RandomNumberGenerator {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / (UINT32_MAX + 1);
  };
}
