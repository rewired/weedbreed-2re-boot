import { describe, expect, it } from 'vitest';

import { createEngineBootstrapConfig } from '../../src/index.js';

describe('tariff resolution (integration)', () => {
  it('memoises tariffs for identical scenario requests', () => {
    const first = createEngineBootstrapConfig('easy');
    const second = createEngineBootstrapConfig('easy');

    expect(first.tariffs).toBe(second.tariffs);
    expect(first.tariffs).toEqual({
      price_electricity: 0.25,
      price_water: 1.5
    });
  });

  it('reuses the fallback difficulty for unknown scenarios', () => {
    const fallback = createEngineBootstrapConfig('normal');
    const unknown = createEngineBootstrapConfig('integration');

    expect(unknown.tariffs).toBe(fallback.tariffs);
    expect(unknown.tariffs).toEqual({
      price_electricity: 0.35,
      price_water: 2
    });
  });
});
