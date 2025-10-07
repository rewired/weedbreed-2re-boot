import stringify from 'safe-stable-stringify';
import xxhash from 'xxhash-wasm';

const SECONDARY_SEED = BigInt('0x9e3779b97f4a7c15');

let hashApiPromise: Promise<Awaited<ReturnType<typeof xxhash>>> | undefined;

async function getHashApi() {
  if (!hashApiPromise) {
    hashApiPromise = xxhash();
  }
  return hashApiPromise;
}

/**
 * Produce a 128-bit (32 hex chars) hash of the canonical JSON representation of a value.
 *
 * The current `xxhash-wasm` release exposes 64-bit helpers. To keep the footprint
 * deterministic we concatenate two 64-bit digests seeded with distinct constants.
 *
 * NOTE: This helper is intended for test scaffolding only. Production subsystems should
 * continue to rely on the existing deterministic UUID services until an ADR approves
 * runtime adoption.
 */
export async function hashCanonicalJson(value: unknown): Promise<string> {
  const canonical = stringify(value);

  if (canonical === undefined) {
    throw new TypeError('hashCanonicalJson: value could not be canonicalised');
  }

  const api = await getHashApi();
  const primary = api.h64ToString(canonical);
  const secondary = api.h64ToString(canonical, SECONDARY_SEED);

  return `${primary}${secondary}`;
}
