import { AIR_DENSITY_KG_PER_M3 } from '../constants/simConstants.js';
import type { SimulationWorld, Uuid } from '../domain/world.js';
import {
  resolvePipelineStage,
  runTick,
  type EngineRunContext,
  type RunTickOptions
} from './Engine.js';
import { clearSensorReadingsRuntime } from './pipeline/applySensors.js';
import { clearIrrigationNutrientsRuntime } from './pipeline/applyIrrigationAndNutrients.js';
import type { StepName, TickTrace } from './trace.js';

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
const DEMO_ZONE_AIR_MASS_KG = 60 * 3 * AIR_DENSITY_KG_PER_M3;

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
      lat: 53.55,
      cityName: 'Hamburg',
      countryName: 'Germany'
    },
    structures: [
      {
        id: DEMO_STRUCTURE_ID,
        slug: 'demo-structure',
        name: 'Demo Structure',
        floorArea_m2: 400,
        height_m: 3,
        devices: [],
        rooms: [
          {
            id: DEMO_ROOM_ID,
            slug: 'veg-room',
            name: 'Vegetative Room',
            purpose: 'growroom',
            floorArea_m2: 120,
            height_m: 3,
            devices: [],
            zones: [
              {
                id: DEMO_ZONE_ID,
                slug: 'zone-a',
                name: 'Zone A',
                floorArea_m2: 60,
                height_m: 3,
                cultivationMethodId: DEMO_CULTIVATION_METHOD_ID,
                irrigationMethodId: DEMO_IRRIGATION_ID,
                containerId: DEMO_CONTAINER_ID,
                substrateId: DEMO_SUBSTRATE_ID,
                airMass_kg: DEMO_ZONE_AIR_MASS_KG,
                lightSchedule: {
                  onHours: 18,
                  offHours: 6,
                  startHour: 0
                },
                photoperiodPhase: 'vegetative',
                environment: {
                  airTemperatureC: 22
                },
                ppfd_umol_m2s: 0,
                dli_mol_m2d_inc: 0,
                nutrientBuffer_mg: {
                  N: 1000,
                  P: 500,
                  K: 800
                },
                moisture01: 0.5,
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
            floorArea_m2: 40,
            height_m: 3,
            devices: [],
            zones: [],
            class: 'room.storage',
            tags: ['storage'],
            inventory: { lots: [] }
          }
        ]
      }
    ]
  }
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
  const warmupTicks = Math.min(tickCount, 5);

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
