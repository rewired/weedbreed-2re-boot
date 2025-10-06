import { describe, expect, it } from 'vitest';

import { hashCanonicalJson } from '../../../../src/shared/determinism/hash.js';

describe('hashCanonicalJson', () => {
  it('produces a 128-bit hex digest', async () => {
    const hash = await hashCanonicalJson({ hello: 'world' });
    expect(hash).toMatch(/^[0-9a-f]{32}$/u);
  });

  it('is stable across key ordering', async () => {
    const valueA = { a: 1, b: 2, nested: { x: true, y: false } };
    const valueB = { nested: { y: false, x: true }, b: 2, a: 1 };

    await expect(hashCanonicalJson(valueA)).resolves.toBe(
      await hashCanonicalJson(valueB)
    );
  });

  it('changes when values differ', async () => {
    const base = { count: 1 };
    const mutated = { count: 2 };

    const [hashA, hashB] = await Promise.all([
      hashCanonicalJson(base),
      hashCanonicalJson(mutated)
    ]);

    expect(hashA).not.toBe(hashB);
  });
});
