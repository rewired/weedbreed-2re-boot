import { describe, expect, it } from 'vitest';

import { HOURS_PER_TICK } from '@/backend/src/constants/simConstants';
import { createNutrientBufferStub } from '@/backend/src/stubs/NutrientBufferStub';
import type { NutrientBufferInputs } from '@/backend/src/domain/interfaces/INutrientBuffer';

const BASE_CAPACITY_MG: Record<string, number> = { N: 10_000, P: 5_000, K: 8_000 };
const BASE_BUFFER_MG: Record<string, number> = { N: 1_000, P: 500, K: 800 };

function createInputs(
  overrides: Partial<NutrientBufferInputs> = {},
): NutrientBufferInputs {
  return {
    capacity_mg: BASE_CAPACITY_MG,
    buffer_mg: BASE_BUFFER_MG,
    flow_mg: { N: 500, P: 250, K: 400 },
    uptake_demand_mg: { N: 300, P: 150, K: 200 },
    leaching01: 0.1,
    nutrientSource: 'substrate',
    ...overrides,
  };
}

describe('NutrientBufferStub', () => {
  const stub = createNutrientBufferStub();

  it('matches the reference vector for nitrogen', () => {
    const inputs = createInputs();
    const result = stub.computeEffect(inputs, HOURS_PER_TICK);

    expect(result.uptake_mg.N).toBeCloseTo(300, 5);
    expect(result.leached_mg.N).toBeCloseTo(50, 5);
    expect(result.new_buffer_mg.N).toBeCloseTo(1_150, 5);
  });

  it('processes nutrients independently across keys', () => {
    const inputs = createInputs({
      flow_mg: { N: 600, K: 100 },
      uptake_demand_mg: { N: 200, K: 80 },
    });

    const result = stub.computeEffect(inputs, HOURS_PER_TICK);

    expect(result.uptake_mg).toMatchObject({ N: 200, K: 80 });
    expect(result.leached_mg.N).toBeCloseTo(60, 5);
    expect(result.leached_mg.K).toBeCloseTo(10, 5);
  });

  it('clamps uptake to available nutrients', () => {
    const inputs = createInputs({
      buffer_mg: { N: 10 },
      flow_mg: { N: 10 },
      uptake_demand_mg: { N: 100 },
    });

    const result = stub.computeEffect(inputs, HOURS_PER_TICK);

    expect(result.uptake_mg.N).toBeLessThanOrEqual(20);
    expect(result.new_buffer_mg.N).toBeGreaterThanOrEqual(0);
  });

  it('clamps new buffer to capacity', () => {
    const inputs = createInputs({
      buffer_mg: { N: 9_900 },
      flow_mg: { N: 5_000 },
      uptake_demand_mg: { N: 0 },
    });

    const result = stub.computeEffect(inputs, HOURS_PER_TICK);

    expect(result.new_buffer_mg.N).toBeLessThanOrEqual(BASE_CAPACITY_MG.N);
  });

  it('returns zero outputs when dt is non-positive', () => {
    const inputs = createInputs();
    expect(stub.computeEffect(inputs, 0)).toEqual({
      uptake_mg: {},
      leached_mg: {},
      new_buffer_mg: {},
    });
  });

  it('throws when leaching ratio falls outside [0,1]', () => {
    const inputs = createInputs({ leaching01: 1.5 });

    expect(() => stub.computeEffect(inputs, HOURS_PER_TICK)).toThrow(RangeError);
  });

  it('handles empty nutrient records', () => {
    const inputs = createInputs({
      capacity_mg: {},
      buffer_mg: {},
      flow_mg: {},
      uptake_demand_mg: {},
    });

    const result = stub.computeEffect(inputs, HOURS_PER_TICK);

    expect(result.uptake_mg).toEqual({});
    expect(result.leached_mg).toEqual({});
    expect(result.new_buffer_mg).toEqual({});
  });

  it('ensures outputs remain finite numbers', () => {
    const inputs = createInputs({
      flow_mg: { N: 1_000_000 },
      uptake_demand_mg: { N: 0 },
    });

    const result = stub.computeEffect(inputs, HOURS_PER_TICK);

    expect(Number.isFinite(result.leached_mg.N)).toBe(true);
    expect(Number.isFinite(result.new_buffer_mg.N)).toBe(true);
  });
});
