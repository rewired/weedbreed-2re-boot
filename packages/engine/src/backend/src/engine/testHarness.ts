import { AIR_DENSITY_KG_PER_M3, AMBIENT_CO2_PPM } from '../constants/simConstants.ts';
import type { SimulationWorld, WorkforceState } from '../domain/world.ts';
import type { Uuid } from '../domain/schemas/primitives.ts';
import {
  resolvePipelineStage,
  runTick,
  type EngineRunContext,
  type RunTickOptions
} from './Engine.ts';
import { clearSensorReadingsRuntime } from './pipeline/applySensors.ts';
import { clearIrrigationNutrientsRuntime } from './pipeline/applyIrrigationAndNutrients.ts';
import { clearWorkforceRuntime } from './pipeline/applyWorkforce.ts';
import type { StepName, TickTrace } from './trace.ts';

const DEMO_WORLD_ID = '00000000-0000-4000-8000-000000000000' as Uuid;
const DEMO_COMPANY_ID = '00000000-0000-4000-8000-000000000001' as Uuid;
const DEMO_STRUCTURE_ID = '00000000-0000-4000-8000-000000000002' as Uuid;
const DEMO_ROOM_ID = '00000000-0000-4000-8000-000000000003' as Uuid;
const DEMO_STORAGEROOM_ID = '00000000-0000-4000-8000-000000000009' as Uuid;
const DEMO_ZONE_ID = '00000000-0000-4000-8000-000000000004' as Uuid;
const DEMO_CONTAINER_ID = '00000000-0000-4000-8000-000000000005' as Uuid;
const DEMO_SUBSTRATE_ID = '00000000-0000-4000-8000-000000000006' as Uuid;
const DEMO_IRRIGATION_ID = '00000000-0000-4000-8000-000000000007' as Uuid;
const DEMO_CULTIVATION_METHOD_ID = '00000000-0000-4000-8000-000000000008' as Uuid;
/* eslint-disable @typescript-eslint/no-magic-numbers -- Demo constants encode fixed scenario geometry */
const DEMO_STRUCTURE_HEIGHT_M = 3 as const;
const DEMO_STRUCTURE_FLOOR_AREA_M2 = 400 as const;
const DEMO_ROOM_FLOOR_AREA_M2 = 120 as const;
const DEMO_ZONE_FLOOR_AREA_M2 = 60 as const;
const DEMO_STORAGE_ROOM_FLOOR_AREA_M2 = 40 as const;
const DEMO_LIGHT_ON_HOURS = 18 as const;
const DEMO_LIGHT_OFF_HOURS = 6 as const;
const DEMO_ZONE_TEMPERATURE_C = 22 as const;
const DEMO_ZONE_RELATIVE_HUMIDITY01 = 0.55 as const;
const DEMO_NUTRIENT_BUFFER_P_MG = 500 as const;
const DEMO_NUTRIENT_BUFFER_K_MG = 800 as const;
const DEMO_ZONE_MOISTURE01 = 0.5 as const;
const DEMO_LOCATION_LAT_DEG = 53.55 as const;
const DEMO_PERF_HARNESS_WARMUP_TICKS = 5 as const;

const DEMO_ZONE_AIR_VOLUME_M3 = DEMO_ZONE_FLOOR_AREA_M2 * DEMO_STRUCTURE_HEIGHT_M;
const DEMO_ZONE_AIR_MASS_KG = DEMO_ZONE_AIR_VOLUME_M3 * AIR_DENSITY_KG_PER_M3;
/* eslint-enable @typescript-eslint/no-magic-numbers */

const DEMO_WORKFORCE: WorkforceState = {
  roles: [],
  employees: [],
  taskDefinitions: [],
  taskQueue: [],
  kpis: [],
  warnings: [],
  payroll: {
    dayIndex: 0,
    totals: {
      baseMinutes: 0,
      otMinutes: 0,
      baseCost: 0,
      otCost: 0,
      totalLaborCost: 0,
    },
    byStructure: [],
  },
  market: { structures: [] },
};

const DEMO_WORLD: SimulationWorld = {
  id: DEMO_WORLD_ID,
  schemaVersion: 'sec-0.2.1',
  seed: 'demo-seed',
  simTimeHours: 0,
  company: {
    id: DEMO_COMPANY_ID,
    slug: 'demo-company',
    name: 'Demo Company',
    location: {
      lon: 10.0,
      lat: DEMO_LOCATION_LAT_DEG,
      cityName: 'Hamburg',
      countryName: 'Germany'
    },
    structures: [
      {
        id: DEMO_STRUCTURE_ID,
        slug: 'demo-structure',
        name: 'Demo Structure',
        floorArea_m2: DEMO_STRUCTURE_FLOOR_AREA_M2,
        height_m: DEMO_STRUCTURE_HEIGHT_M,
        devices: [],
        rooms: [
          {
            id: DEMO_ROOM_ID,
            slug: 'veg-room',
            name: 'Vegetative Room',
            purpose: 'growroom',
            floorArea_m2: DEMO_ROOM_FLOOR_AREA_M2,
            height_m: DEMO_STRUCTURE_HEIGHT_M,
            devices: [],
            zones: [
              {
                id: DEMO_ZONE_ID,
                slug: 'zone-a',
                name: 'Zone A',
                floorArea_m2: DEMO_ZONE_FLOOR_AREA_M2,
                height_m: DEMO_STRUCTURE_HEIGHT_M,
                cultivationMethodId: DEMO_CULTIVATION_METHOD_ID,
                irrigationMethodId: DEMO_IRRIGATION_ID,
                containerId: DEMO_CONTAINER_ID,
                substrateId: DEMO_SUBSTRATE_ID,
                airMass_kg: DEMO_ZONE_AIR_MASS_KG,
                lightSchedule: {
                  onHours: DEMO_LIGHT_ON_HOURS,
                  offHours: DEMO_LIGHT_OFF_HOURS,
                  startHour: 0
                },
                photoperiodPhase: 'vegetative',
                environment: {
                  airTemperatureC: DEMO_ZONE_TEMPERATURE_C,
                  relativeHumidity01: DEMO_ZONE_RELATIVE_HUMIDITY01,
                  co2_ppm: AMBIENT_CO2_PPM
                },
                ppfd_umol_m2s: 0,
                dli_mol_m2d_inc: 0,
                nutrientBuffer_mg: {
                  N: 1000,
                  P: DEMO_NUTRIENT_BUFFER_P_MG,
                  K: DEMO_NUTRIENT_BUFFER_K_MG
                },
                moisture01: DEMO_ZONE_MOISTURE01,
                plants: [],
                devices: []
              }
            ]
          },
          {
            id: DEMO_STORAGEROOM_ID,
            slug: 'storage-room',
            name: 'Storage Room',
            purpose: 'storageroom',
            floorArea_m2: DEMO_STORAGE_ROOM_FLOOR_AREA_M2,
            height_m: DEMO_STRUCTURE_HEIGHT_M,
            devices: [],
            zones: [],
            class: 'room.storage',
            tags: ['storage'],
            inventory: { lots: [] }
          }
        ]
      }
    ]
  },
  workforce: DEMO_WORKFORCE,
};

function cloneSimulationWorld(world: SimulationWorld): SimulationWorld {
  return JSON.parse(JSON.stringify(world)) as SimulationWorld;
}

export function createDemoWorld(): SimulationWorld {
  return cloneSimulationWorld(DEMO_WORLD);
}

export function runStages(
  world: SimulationWorld,
  ctx: EngineRunContext,
  stages: readonly StepName[]
): SimulationWorld {
  let nextWorld = world;

  for (const stepName of stages) {
    const stageFn = resolvePipelineStage(stepName);
    nextWorld = stageFn(nextWorld, ctx);

    ctx.instrumentation?.onStageComplete?.(stepName, nextWorld);

    if (stepName === 'applySensors') {
      clearSensorReadingsRuntime(ctx);
    }

    if (stepName === 'applyIrrigationAndNutrients') {
      clearIrrigationNutrientsRuntime(ctx);
    }

    if (stepName === 'applyWorkforce') {
      clearWorkforceRuntime(ctx);
    }
  }

  return nextWorld;
}

export interface RunOneTickOptions {
  readonly world?: SimulationWorld;
  readonly context?: EngineRunContext;
  readonly runTickOptions?: RunTickOptions;
}

export interface RunOneTickResult {
  readonly world: SimulationWorld;
  readonly context: EngineRunContext;
  readonly trace: TickTrace;
}

export function runOneTickWithTrace(options: RunOneTickOptions = {}): RunOneTickResult {
  const world = options.world ?? createDemoWorld();
  const context = options.context ?? {};
  const tickResult = runTick(world, context, { trace: true, ...options.runTickOptions });
  const { trace, world: nextWorld } = tickResult;

  if (!trace) {
    throw new Error('Tick trace collection is mandatory for runOneTickWithTrace');
  }

  return { world: nextWorld, context, trace } satisfies RunOneTickResult;
}

export interface PerfHarnessOptions {
  readonly ticks: number;
  readonly worldFactory?: () => SimulationWorld;
  readonly contextFactory?: () => EngineRunContext;
  readonly runTickOptions?: RunTickOptions;
}

export interface PerfHarnessResult {
  readonly traces: readonly TickTrace[];
  readonly totalDurationNs: number;
  readonly averageDurationNs: number;
  readonly maxHeapUsedBytes: number;
}

export function withPerfHarness(options: PerfHarnessOptions): PerfHarnessResult {
  const tickCount = Math.max(1, Math.trunc(options.ticks));
  const worldFactory = options.worldFactory ?? createDemoWorld;
  const contextFactory = options.contextFactory ?? (() => ({}));
  const warmupTicks = Math.min(tickCount, DEMO_PERF_HARNESS_WARMUP_TICKS);

  // Warm-up phase to allow for JIT compilation and other runtime optimizations
  for (let i = 0; i < warmupTicks; i += 1) {
    const world = worldFactory();
    const context = contextFactory();
    void runTick(world, context, { ...options.runTickOptions, trace: false });
  }

  const traces: TickTrace[] = [];

  for (let i = 0; i < tickCount; i += 1) {
    const world = worldFactory();
    const context = contextFactory();
    const { trace } = runTick(world, context, { trace: true, ...options.runTickOptions });

    if (!trace) {
      throw new Error('Perf harness requires trace data for every tick');
    }

    traces.push(trace);
  }

  const totalDurationNs = traces.reduce((sum, t) => sum + t.durationNs, 0);
  const averageDurationNs = traces.length ? totalDurationNs / traces.length : 0;
  const maxHeapUsedBytes = traces.reduce(
    (max, trace) => (trace.maxHeapUsedBytes > max ? trace.maxHeapUsedBytes : max),
    0
  );

  return {
    traces,
    totalDurationNs,
    averageDurationNs,
    maxHeapUsedBytes
  } satisfies PerfHarnessResult;
}

export function createRecordingContext(buffer: StepName[]): EngineRunContext {
  return {
    instrumentation: {
      onStageComplete: (stage) => {
        buffer.push(stage);
      }
    }
  } satisfies EngineRunContext;
}

export { runDeterministic } from './conformance/runDeterministic.ts';
