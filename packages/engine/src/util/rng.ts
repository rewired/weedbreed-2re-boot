import { createHash } from 'node:crypto';

/**
 * Deterministic pseudo-random number generator factory.
 *
 * A keyed hash of the `seed` and `streamId` produces the initial state which
 * is then advanced using a xoshiro128** style generator. The generator returns
 * Float64 numbers in [0, 1).
 */
export function createRng(seed: string, streamId: string): () => number {
  const digest = createHash('sha256').update(seed).update(':').update(streamId).digest();
  let a = digest.readUInt32LE(0);
  let b = digest.readUInt32LE(4);
  let c = digest.readUInt32LE(8);
  let d = digest.readUInt32LE(12);

  return () => {
    const t = b << 9;

    let r = a * 5;
    r = ((r << 7) | (r >>> 25)) * 9;

    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;

    c ^= t;
    d = (d << 11) | (d >>> 21);

    return ((r >>> 0) / 4294967296);
  };
}
