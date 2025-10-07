import type {
  INutrientBuffer,
  NutrientBufferInputs,
  NutrientBufferOutputs,
} from '../domain/interfaces/INutrientBuffer.js';
import { clamp } from '../util/math.js';
import { resolveTickHoursValue } from '../engine/resolveTickHours.js';

function clampNutrientRecord(
  record: Record<string, number>,
  min: number,
  max: number,
): Record<string, number> {
  const clamped: Record<string, number> = {};

  for (const [key, value] of Object.entries(record)) {
    clamped[key] = clamp(value, min, max);
  }

  return clamped;
}

function sumNutrientRecords(
  ...records: ReadonlyArray<Record<string, number>>
): Record<string, number> {
  const summed: Record<string, number> = {};

  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      const current = summed[key] ?? 0;
      summed[key] = Number.isFinite(value) ? current + value : current;
    }
  }

  return summed;
}

function ensureFiniteOutputs(
  outputs: NutrientBufferOutputs,
): NutrientBufferOutputs {
  for (const record of [outputs.uptake_mg, outputs.leached_mg, outputs.new_buffer_mg]) {
    for (const value of Object.values(record)) {
      if (!Number.isFinite(value)) {
        throw new Error('Nutrient buffer outputs must be finite numbers.');
      }
    }
  }

  return outputs;
}

function zeroOutputs(): NutrientBufferOutputs {
  return { uptake_mg: {}, leached_mg: {}, new_buffer_mg: {} };
}

/**
 * Deterministic stub implementation of {@link INutrientBuffer} following the
 * consolidated reference (Section 4.4 NutrientBufferStub).
 *
 * The flow is computed in four distinct phases per nutrient key:
 *
 * 1. **Leaching** removes a fraction of the incoming nutrient flow based on
 *    {@link NutrientBufferInputs.leaching01}.
 * 2. **Availability** adds the non-leached flow to the existing buffer.
 * 3. **Uptake** clamps plant demand to the available amount to avoid
 *    overdrawing the buffer.
 * 4. **Buffer update** stores the residual nutrients back into the buffer,
 *    respecting the declared capacity.
 *
 * Water inventory and moisture modelling remain out of scope for Phase 1; the
 * implementation is intentionally pure for deterministic composition within the
 * engine pipeline.
 */
export function createNutrientBufferStub(): INutrientBuffer {
  return {
    computeEffect(inputs: NutrientBufferInputs, dt_h: number): NutrientBufferOutputs {
      if (typeof dt_h === 'number' && (!Number.isFinite(dt_h) || dt_h <= 0)) {
        return zeroOutputs();
      }

      const resolvedDt_h = resolveTickHoursValue(dt_h);

      if (!Number.isFinite(resolvedDt_h) || resolvedDt_h <= 0) {
        return zeroOutputs();
      }

      const { leaching01 } = inputs;

      if (!Number.isFinite(leaching01) || leaching01 < 0 || leaching01 > 1) {
        throw new RangeError('Nutrient leaching ratio must lie within [0,1].');
      }

      const capacity = clampNutrientRecord(inputs.capacity_mg, 0, Infinity);
      const buffer = clampNutrientRecord(inputs.buffer_mg, 0, Infinity);
      const flow = clampNutrientRecord(inputs.flow_mg, 0, Infinity);
      const demand = clampNutrientRecord(inputs.uptake_demand_mg, 0, Infinity);

      const nutrientKeys = Object.keys(sumNutrientRecords(capacity, buffer, flow, demand));

      const leached_mg: Record<string, number> = {};
      const uptake_mg: Record<string, number> = {};
      const new_buffer_mg: Record<string, number> = {};

      for (const key of nutrientKeys) {
        const capacityValue = capacity[key] ?? Infinity;
        const bufferValue = buffer[key] ?? 0;
        const flowValue = flow[key] ?? 0;
        const demandValue = demand[key] ?? 0;

        const leached = clamp(flowValue * leaching01, 0, flowValue);
        const available = Math.max(0, bufferValue + flowValue - leached);
        const uptake = clamp(demandValue, 0, available);
        const updatedBuffer = clamp(
          bufferValue + flowValue - leached - uptake,
          0,
          Number.isFinite(capacityValue) ? capacityValue : Infinity,
        );

        if (leached > 0) {
          leached_mg[key] = leached;
        }

        if (uptake > 0) {
          uptake_mg[key] = uptake;
        }

        if (updatedBuffer > 0) {
          new_buffer_mg[key] = updatedBuffer;
        } else if (capacityValue === 0 || bufferValue + flowValue - leached - uptake <= 0) {
          new_buffer_mg[key] = 0;
        }
      }

      return ensureFiniteOutputs({ uptake_mg, leached_mg, new_buffer_mg });
    },
  } satisfies INutrientBuffer;
}
