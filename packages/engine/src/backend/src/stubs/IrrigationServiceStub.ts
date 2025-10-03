import { HOURS_PER_TICK } from '../constants/simConstants.js';
import type {
  IIrrigationService,
  IrrigationEvent,
  IrrigationServiceInputs,
  IrrigationServiceOutputs,
} from '../domain/interfaces/IIrrigationService.js';
import type {
  INutrientBuffer,
  NutrientBufferInputs,
} from '../domain/interfaces/INutrientBuffer.js';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function resolveTickHours(tickHours: number | undefined): number {
  if (typeof tickHours !== 'number') {
    return HOURS_PER_TICK;
  }

  if (!Number.isFinite(tickHours) || tickHours <= 0) {
    return HOURS_PER_TICK;
  }

  return tickHours;
}

function multiplyNutrientRecord(
  record: Record<string, number>,
  factor: number,
): Record<string, number> {
  const scaled: Record<string, number> = {};

  if (!Number.isFinite(factor) || factor <= 0) {
    return scaled;
  }

  for (const [key, value] of Object.entries(record)) {
    if (Number.isFinite(value) && value > 0) {
      scaled[key] = value * factor;
    }
  }

  return scaled;
}

function sumNutrientRecords(
  ...records: Array<Record<string, number>>
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
  outputs: IrrigationServiceOutputs,
): IrrigationServiceOutputs {
  if (!Number.isFinite(outputs.water_L)) {
    throw new Error('Irrigation service outputs must contain a finite water total.');
  }

  for (const record of [outputs.nutrients_mg, outputs.uptake_mg, outputs.leached_mg]) {
    for (const value of Object.values(record)) {
      if (!Number.isFinite(value)) {
        throw new Error('Irrigation service nutrient totals must be finite numbers.');
      }
    }
  }

  return outputs;
}

function zeroOutputs(): IrrigationServiceOutputs {
  return { water_L: 0, nutrients_mg: {}, uptake_mg: {}, leached_mg: {} };
}

function aggregateEventNutrients(events: IrrigationEvent[]): {
  water_L: number;
  nutrients_mg: Record<string, number>;
} {
  let water_L = 0;
  const nutrientTotals: Array<Record<string, number>> = [];

  for (const event of events) {
    const volume = Number.isFinite(event.water_L) ? Math.max(0, event.water_L) : 0;
    water_L += volume;

    if (volume === 0) {
      continue;
    }

    nutrientTotals.push(multiplyNutrientRecord(event.concentrations_mg_per_L, volume));
  }

  return {
    water_L,
    nutrients_mg: nutrientTotals.length === 0 ? {} : sumNutrientRecords(...nutrientTotals),
  };
}

function createBufferInputs(
  inputs: IrrigationServiceInputs,
  bufferState: Record<string, number>,
  nutrients_mg: Record<string, number>,
): NutrientBufferInputs {
  const nutrientKeys = Object.keys(sumNutrientRecords(bufferState, nutrients_mg));
  const capacity_mg: Record<string, number> = {};
  const buffer_mg: Record<string, number> = {};

  for (const key of nutrientKeys) {
    capacity_mg[key] = Number.MAX_SAFE_INTEGER;
    buffer_mg[key] = Number.isFinite(bufferState[key]) ? Math.max(0, bufferState[key]) : 0;
  }

  return {
    capacity_mg,
    buffer_mg,
    flow_mg: nutrients_mg,
    uptake_demand_mg: {},
    leaching01: clamp(0.1, 0, 1),
    nutrientSource: inputs.nutrientSource,
  };
}

/**
 * Phase 1 deterministic stub for {@link IIrrigationService} that aggregates
 * irrigation events, translates delivered solution into nutrient mass, and
 * delegates storage dynamics to the injected {@link INutrientBuffer} stub.
 */
export function createIrrigationServiceStub(
  bufferStub: INutrientBuffer,
): IIrrigationService {
  return {
    computeEffect(
      inputs: IrrigationServiceInputs,
      bufferState: Record<string, number>,
      dt_h: number,
    ): IrrigationServiceOutputs {
      if (typeof dt_h === 'number' && (!Number.isFinite(dt_h) || dt_h <= 0)) {
        return zeroOutputs();
      }

      const resolvedDt_h = resolveTickHours(dt_h);

      if (!Number.isFinite(resolvedDt_h) || resolvedDt_h <= 0) {
        return zeroOutputs();
      }

      const events = Array.isArray(inputs.events) ? inputs.events : [];

      if (events.length === 0) {
        return zeroOutputs();
      }

      const { water_L, nutrients_mg } = aggregateEventNutrients(events);

      if (water_L === 0) {
        return zeroOutputs();
      }

      const bufferInputs = createBufferInputs(inputs, bufferState, nutrients_mg);
      const bufferResult = bufferStub.computeEffect(bufferInputs, resolvedDt_h);

      const outputs: IrrigationServiceOutputs = {
        water_L,
        nutrients_mg,
        uptake_mg: bufferResult.uptake_mg,
        leached_mg: bufferResult.leached_mg,
      };

      return ensureFiniteOutputs(outputs);
    },
  } satisfies IIrrigationService;
}
