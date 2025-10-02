import { describe, expect, it, vi } from 'vitest';

import {
  applyRepair,
  canRepair,
  degradeCondition,
  needsMaintenance,
  type RepairOptions
} from '@/backend/src/domain/world.js';

describe('degradeCondition', () => {
  it('reduces wear as quality improves', () => {
    const startingCondition = 0.9;

    const lowQuality = degradeCondition(startingCondition, 0);
    const highQuality = degradeCondition(startingCondition, 1);

    expect(highQuality).toBeGreaterThan(lowQuality);
    expect(highQuality).toBeLessThanOrEqual(startingCondition);
  });

  it('clamps condition within the unit interval', () => {
    expect(degradeCondition(1.4, 0.5)).toBeLessThanOrEqual(1);
    expect(degradeCondition(-0.1, 0.5)).toBe(0);
  });
});

describe('needsMaintenance', () => {
  it('flags condition at or below the maintenance threshold', () => {
    expect(needsMaintenance(0.25, 0.3)).toBe(true);
    expect(needsMaintenance(0.3, 0.3)).toBe(true);
  });

  it('returns false when condition is comfortably above the threshold', () => {
    expect(needsMaintenance(0.6, 0.3)).toBe(false);
  });
});

describe('canRepair', () => {
  it('requires condition to meet the minimum repair threshold', () => {
    expect(canRepair(0.45, 0.4)).toBe(true);
    expect(canRepair(0.39, 0.4)).toBe(false);
  });
});

describe('applyRepair', () => {
  it('does not repair when the device is below the minimum threshold', () => {
    const outcome = applyRepair({
      condition01: 0.2,
      repairMinThreshold01: 0.3,
      repairAmount01: 0.5
    });

    expect(outcome.success).toBe(false);
    expect(outcome.condition01).toBe(0.2);
  });

  it('repairs and clamps condition when successful', () => {
    const outcome = applyRepair({
      condition01: 0.7,
      repairMinThreshold01: 0.5,
      repairAmount01: 0.5
    });

    expect(outcome.success).toBe(true);
    expect(outcome.condition01).toBe(1);
  });

  it('consults the provided RNG hook when probability is partial', () => {
    const sampler = vi.fn<NonNullable<RepairOptions['sampleSuccess']>, [number]>((chance) => {
      expect(chance).toBe(0.25);
      return false;
    });

    const failure = applyRepair({
      condition01: 0.8,
      repairMinThreshold01: 0.5,
      repairAmount01: 0.1,
      successChance01: 0.25,
      sampleSuccess: sampler
    });

    expect(sampler).toHaveBeenCalledTimes(1);
    expect(failure.success).toBe(false);
    expect(failure.condition01).toBe(0.8);

    sampler.mockReturnValueOnce(true);

    const success = applyRepair({
      condition01: 0.8,
      repairMinThreshold01: 0.5,
      repairAmount01: 0.1,
      successChance01: 0.25,
      sampleSuccess: sampler
    });

    expect(success.success).toBe(true);
    expect(success.condition01).toBeCloseTo(0.9, 5);
  });
});
