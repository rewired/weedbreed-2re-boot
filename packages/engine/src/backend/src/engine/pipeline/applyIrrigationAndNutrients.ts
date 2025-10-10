import { resolveTickHours } from '../resolveTickHours.ts';
import { createIrrigationServiceStub, createNutrientBufferStub } from '../../stubs/index.ts';
import type { SimulationWorld, Zone } from '../../domain/world.ts';
import type { EngineDiagnostic, EngineRunContext } from '../Engine.ts';
import { accumulateWaterConsumption } from '../../economy/runtime.ts';
import type {
  IrrigationEvent,
  IrrigationServiceInputs,
} from '../../domain/interfaces/IIrrigationService.ts';
import type { NutrientBufferInputs } from '../../domain/interfaces/INutrientBuffer.ts';

export interface IrrigationNutrientsRuntime {
  readonly zoneWaterDelivered_L: Map<Zone['id'], number>;
  readonly zoneNutrientsDelivered_mg: Map<Zone['id'], Record<string, number>>;
  readonly zoneNutrientsUptake_mg: Map<Zone['id'], Record<string, number>>;
  readonly zoneNutrientsLeached_mg: Map<Zone['id'], Record<string, number>>;
  readonly zoneBufferUpdates_mg: Map<Zone['id'], Record<string, number>>;
}

const IRRIGATION_RUNTIME_CONTEXT_KEY = '__wb_irrigationNutrients' as const;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type IrrigationRuntimeCarrier = Mutable<EngineRunContext> & {
  [IRRIGATION_RUNTIME_CONTEXT_KEY]?: IrrigationNutrientsRuntime;
};

function setIrrigationRuntime(
  ctx: EngineRunContext,
  runtime: IrrigationNutrientsRuntime
): IrrigationNutrientsRuntime {
  (ctx as IrrigationRuntimeCarrier)[IRRIGATION_RUNTIME_CONTEXT_KEY] = runtime;
  return runtime;
}

export function ensureIrrigationNutrientsRuntime(
  ctx: EngineRunContext
): IrrigationNutrientsRuntime {
  return setIrrigationRuntime(ctx, {
    zoneWaterDelivered_L: new Map(),
    zoneNutrientsDelivered_mg: new Map(),
    zoneNutrientsUptake_mg: new Map(),
    zoneNutrientsLeached_mg: new Map(),
    zoneBufferUpdates_mg: new Map(),
  });
}

export function getIrrigationNutrientsRuntime(
  ctx: EngineRunContext
): IrrigationNutrientsRuntime | undefined {
  return (ctx as IrrigationRuntimeCarrier)[IRRIGATION_RUNTIME_CONTEXT_KEY];
}

export function clearIrrigationNutrientsRuntime(ctx: EngineRunContext): void {
  const carrier = ctx as IrrigationRuntimeCarrier;

  if (IRRIGATION_RUNTIME_CONTEXT_KEY in carrier) {
    carrier[IRRIGATION_RUNTIME_CONTEXT_KEY] = undefined;
  }
}

const DEFAULT_LEACHING_RATIO = 0.1;

function normalizeBufferState(buffer: Record<string, number>): Record<string, number> {
  const normalized: Record<string, number> = {};

  for (const [key, value] of Object.entries(buffer)) {
    if (Number.isFinite(value) && value > 0) {
      normalized[key] = value;
    } else if (Number.isFinite(value) && value <= 0) {
      normalized[key] = 0;
    }
  }

  return normalized;
}

function createBufferInputs(
  inputs: IrrigationServiceInputs,
  bufferState: Record<string, number>,
  nutrients_mg: Record<string, number>,
): NutrientBufferInputs {
  const keys = new Set<string>([
    ...Object.keys(bufferState ?? {}),
    ...Object.keys(nutrients_mg ?? {}),
  ]);
  const capacity_mg: Record<string, number> = {};
  const buffer_mg: Record<string, number> = normalizeBufferState(bufferState ?? {});

  for (const key of keys) {
    capacity_mg[key] = Number.MAX_SAFE_INTEGER;

    if (!(key in buffer_mg)) {
      buffer_mg[key] = 0;
    }
  }

  return {
    capacity_mg,
    buffer_mg,
    flow_mg: { ...nutrients_mg },
    uptake_demand_mg: {},
    leaching01: DEFAULT_LEACHING_RATIO,
    nutrientSource: inputs.nutrientSource,
  } satisfies NutrientBufferInputs;
}

function emitIrrigationDiagnostic(
  ctx: EngineRunContext,
  zone: Zone,
  outputs: {
    readonly water_L: number;
    readonly nutrients_mg: Record<string, number>;
    readonly uptake_mg: Record<string, number>;
    readonly leached_mg: Record<string, number>;
  },
): void {
  if (outputs.water_L <= 0) {
    return;
  }

  const diagnostic: EngineDiagnostic = {
    scope: 'zone',
    code: 'zone.irrigation.applied',
    zoneId: zone.id,
    message: `Zone "${zone.name}" received ${outputs.water_L.toFixed(2)} L water.`,
    metadata: {
      water_L: outputs.water_L,
      nutrients_mg: outputs.nutrients_mg,
      uptake_mg: outputs.uptake_mg,
      leached_mg: outputs.leached_mg,
    },
  };

  ctx.diagnostics?.emit(diagnostic);
}

function groupEventsByZone(
  events: readonly IrrigationEvent[],
): Map<Zone['id'], IrrigationEvent[]> {
  const grouped = new Map<Zone['id'], IrrigationEvent[]>();

  for (const event of events) {
    const current = grouped.get(event.targetZoneId) ?? [];
    current.push(event);
    grouped.set(event.targetZoneId, current);
  }

  return grouped;
}

export function applyIrrigationAndNutrients(
  world: SimulationWorld,
  ctx: EngineRunContext,
): SimulationWorld {
  const events =
    ((ctx as { irrigationEvents?: readonly IrrigationEvent[] }).irrigationEvents ?? []) as
      | readonly IrrigationEvent[]
      | [];

  if (events.length === 0) {
    ensureIrrigationNutrientsRuntime(ctx);
    return world;
  }

  const runtime = ensureIrrigationNutrientsRuntime(ctx);
  const dt_h = resolveTickHours(ctx);

  const bufferStub = createNutrientBufferStub();
  const irrigationStub = createIrrigationServiceStub(bufferStub);
  const groupedEvents = groupEventsByZone(events);

  let worldMutated = false;

  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      for (const zone of room.zones) {
        const zoneEvents = groupedEvents.get(zone.id);

        if (!zoneEvents || zoneEvents.length === 0) {
          continue;
        }

        const inputs: IrrigationServiceInputs = {
          events: zoneEvents,
          nutrientSource: 'solution',
        };
        const bufferState = zone.nutrientBuffer_mg ?? {};
        const outputs = irrigationStub.computeEffect(inputs, bufferState, dt_h);

        if (outputs.water_L <= 0 && Object.keys(outputs.nutrients_mg).length === 0) {
          continue;
        }

        const bufferInputs = createBufferInputs(inputs, bufferState, outputs.nutrients_mg);
        const bufferResult = bufferStub.computeEffect(bufferInputs, dt_h);

        runtime.zoneWaterDelivered_L.set(zone.id, outputs.water_L);
        runtime.zoneNutrientsDelivered_mg.set(zone.id, { ...outputs.nutrients_mg });
        runtime.zoneNutrientsUptake_mg.set(zone.id, { ...outputs.uptake_mg });
        runtime.zoneNutrientsLeached_mg.set(zone.id, { ...outputs.leached_mg });
        runtime.zoneBufferUpdates_mg.set(zone.id, { ...bufferResult.new_buffer_mg });

        if (outputs.water_L > 0) {
          accumulateWaterConsumption(ctx, outputs.water_L);
        }

        emitIrrigationDiagnostic(ctx, zone, outputs);

        worldMutated = true;
      }
    }
  }

  if (!worldMutated) {
    return world;
  }

  const nextStructures = world.company.structures.map((structure) => {
    let structureChanged = false;

    const nextRooms = structure.rooms.map((room) => {
      let roomChanged = false;

      const nextZones = room.zones.map((zone) => {
        if (!runtime.zoneBufferUpdates_mg.has(zone.id)) {
          return zone;
        }

        roomChanged = true;
        structureChanged = true;

        return {
          ...zone,
          nutrientBuffer_mg: runtime.zoneBufferUpdates_mg.get(zone.id) ?? zone.nutrientBuffer_mg,
        } satisfies Zone;
      });

      if (!roomChanged) {
        return room;
      }

      return { ...room, zones: nextZones } satisfies typeof room;
    });

    if (!structureChanged) {
      return structure;
    }

    return { ...structure, rooms: nextRooms } satisfies typeof structure;
  });

  const nextWorld: SimulationWorld = {
    ...world,
    company: {
      ...world.company,
      structures: nextStructures,
    },
  };

  return nextWorld;
}
