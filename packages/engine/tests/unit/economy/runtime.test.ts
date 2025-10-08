import { describe, expect, it } from 'vitest';

import {
  accumulateEnergyConsumption,
  accumulateWaterConsumption,
  consumeEconomyUsageRuntime
} from '@/backend/src/economy/runtime';
import type { EngineRunContext } from '@/backend/src/engine/Engine';

describe('economy usage runtime', () => {
  it('accumulates energy and water usage and resets after consumption', () => {
    const ctx: EngineRunContext = {};

    accumulateEnergyConsumption(ctx, 1.2);
    accumulateWaterConsumption(ctx, 500);

    const first = consumeEconomyUsageRuntime(ctx);
    expect(first).toEqual({
      energyConsumption_kWh: 1.2,
      waterVolume_m3: 0.5
    });

    const second = consumeEconomyUsageRuntime(ctx);
    expect(second).toBeUndefined();
  });

  it('ignores non-positive increments', () => {
    const ctx: EngineRunContext = {};

    accumulateEnergyConsumption(ctx, -1);
    accumulateWaterConsumption(ctx, 0);

    expect(consumeEconomyUsageRuntime(ctx)).toBeUndefined();
  });
});
