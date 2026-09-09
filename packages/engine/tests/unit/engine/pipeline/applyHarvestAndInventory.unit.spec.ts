import { describe, expect, it } from 'vitest';

import { applyHarvestAndInventory } from '@/backend/src/engine/pipeline/applyHarvestAndInventory';
import { createDemoWorld } from '@/backend/src/engine/testHarness';

describe('applyHarvestAndInventory (unit)', () => {
  it('preserves the world because harvest is an explicit player command', () => {
    const world = createDemoWorld();

    expect(applyHarvestAndInventory(world, {})).toBe(world);
  });
});
