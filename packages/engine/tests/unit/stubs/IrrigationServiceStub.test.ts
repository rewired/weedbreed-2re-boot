import { describe, expect, it, vi } from 'vitest';

import { HOURS_PER_TICK } from '@/backend/src/constants/simConstants';
import { createIrrigationServiceStub } from '@/backend/src/stubs/IrrigationServiceStub';
import { createNutrientBufferStub } from '@/backend/src/stubs/NutrientBufferStub';
import type {
  IrrigationEvent,
  IrrigationServiceInputs,
} from '@/backend/src/domain/interfaces/IIrrigationService';
import type { INutrientBuffer } from '@/backend/src/domain/interfaces/INutrientBuffer';
import type { Uuid } from '@/backend/src/domain/entities';

const MOCK_ZONE_ID = 'zone-123' as Uuid;
const MOCK_PLANT_ID = 'plant-456' as Uuid;
const BASE_BUFFER_STATE: Record<string, number> = { N: 1_000, P: 500, K: 800 };

function createEvent(overrides: Partial<IrrigationEvent> = {}): IrrigationEvent {
  return {
    water_L: 10,
    concentrations_mg_per_L: { N: 50, P: 25, K: 40 },
    targetZoneId: MOCK_ZONE_ID,
    targetPlantId: MOCK_PLANT_ID,
    ...overrides,
  };
}

function createInputs(
  overrides: Partial<IrrigationServiceInputs> = {},
): IrrigationServiceInputs {
  return {
    events: [createEvent()],
    nutrientSource: 'solution',
    ...overrides,
  };
}

describe('IrrigationServiceStub', () => {
  const bufferStub = createNutrientBufferStub();
  const stub = createIrrigationServiceStub(bufferStub);

  it('aggregates a single irrigation event into water and nutrient totals', () => {
    const inputs = createInputs();
    const result = stub.computeEffect(inputs, BASE_BUFFER_STATE, HOURS_PER_TICK);

    expect(result.water_L).toBeCloseTo(10, 5);
    expect(result.nutrients_mg.N).toBeCloseTo(500, 5);
    expect(result.nutrients_mg.P).toBeCloseTo(250, 5);
    expect(result.nutrients_mg.K).toBeCloseTo(400, 5);
  });

  it('sums multiple events including partial nutrient profiles', () => {
    const inputs = createInputs({
      events: [
        createEvent(),
        createEvent({ water_L: 5, concentrations_mg_per_L: { N: 30, Ca: 10 } }),
      ],
    });

    const result = stub.computeEffect(inputs, BASE_BUFFER_STATE, HOURS_PER_TICK);

    expect(result.water_L).toBeCloseTo(15, 5);
    expect(result.nutrients_mg.N).toBeCloseTo(650, 5);
    expect(result.nutrients_mg.P).toBeCloseTo(250, 5);
    expect(result.nutrients_mg.K).toBeCloseTo(400, 5);
    expect(result.nutrients_mg.Ca).toBeCloseTo(50, 5);
  });

  it('delegates nutrient dynamics to the buffer stub', () => {
    const inputs = createInputs({ events: [createEvent({ water_L: 8 })] });
    const result = stub.computeEffect(inputs, BASE_BUFFER_STATE, HOURS_PER_TICK);

    expect(result.leached_mg.N).toBeCloseTo(40, 5);
    expect(result.uptake_mg.N ?? 0).toBe(0);
  });

  it('returns zeros when no events are provided', () => {
    const inputs = createInputs({ events: [] });
    const result = stub.computeEffect(inputs, BASE_BUFFER_STATE, HOURS_PER_TICK);

    expect(result).toEqual({ water_L: 0, nutrients_mg: {}, uptake_mg: {}, leached_mg: {} });
  });

  it('returns zeros when dt is non-positive', () => {
    const inputs = createInputs();
    const result = stub.computeEffect(inputs, BASE_BUFFER_STATE, 0);

    expect(result).toEqual({ water_L: 0, nutrients_mg: {}, uptake_mg: {}, leached_mg: {} });
  });

  it('supports injecting a mock nutrient buffer', () => {
    const computeEffect = vi.fn().mockReturnValue({
      uptake_mg: { N: 10 },
      leached_mg: { N: 5 },
      new_buffer_mg: { N: 995 },
    });

    const mockBufferStub: INutrientBuffer = {
      computeEffect,
    };

    const irrigationStub = createIrrigationServiceStub(mockBufferStub);
    const inputs = createInputs();
    const result = irrigationStub.computeEffect(inputs, BASE_BUFFER_STATE, HOURS_PER_TICK);

    expect(computeEffect).toHaveBeenCalled();
    expect(result.uptake_mg.N).toBe(10);
    expect(result.leached_mg.N).toBe(5);
  });

  it('leaves nutrient totals empty when concentrations are zero', () => {
    const inputs = createInputs({
      events: [createEvent({ water_L: 5, concentrations_mg_per_L: {} })],
    });

    const result = stub.computeEffect(inputs, BASE_BUFFER_STATE, HOURS_PER_TICK);

    expect(result.water_L).toBe(5);
    expect(result.nutrients_mg).toEqual({});
  });
});
