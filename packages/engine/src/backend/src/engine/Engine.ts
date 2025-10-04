import type { SimulationWorld, Uuid } from '../domain/world.js';
import type { IrrigationEvent } from '../domain/interfaces/IIrrigationService.js';
import { applyDeviceEffects } from './pipeline/applyDeviceEffects.js';
import { updateEnvironment } from './pipeline/updateEnvironment.js';
import { applySensors, clearSensorReadingsRuntime } from './pipeline/applySensors.js';
import {
  applyIrrigationAndNutrients,
  clearIrrigationNutrientsRuntime,
} from './pipeline/applyIrrigationAndNutrients.js';
import { advancePhysiology } from './pipeline/advancePhysiology.js';
import { applyHarvestAndInventory } from './pipeline/applyHarvestAndInventory.js';
import { applyEconomyAccrual } from './pipeline/applyEconomyAccrual.js';
import { commitAndTelemetry } from './pipeline/commitAndTelemetry.js';
import { createTickTraceCollector, type StepName, type TickTrace } from './trace.js';

export interface EngineInstrumentation {
  readonly onStageComplete?: (stage: StepName, world: SimulationWorld) => void;
}

export interface EngineDiagnostic {
  readonly scope: 'zone';
  readonly code: string;
  readonly zoneId: Uuid;
  readonly message: string;
  readonly metadata?: Record<string, unknown>;
}

export interface EngineDiagnosticsSink {
  emit(diagnostic: EngineDiagnostic): void;
}

export interface EngineRunContext {
  readonly instrumentation?: EngineInstrumentation;
  readonly diagnostics?: EngineDiagnosticsSink;
  readonly irrigationEvents?: readonly IrrigationEvent[];
  /**
   * Preferred tick duration hint in in-game hours.
   * When omitted the engine defaults to the canonical one-hour tick duration.
   */
  readonly tickDurationHours?: number;
  /**
   * @deprecated Legacy alias for {@link EngineRunContext.tickDurationHours}. Prefer {@link tickDurationHours}.
   */
  readonly tickHours?: number;
  readonly [key: string]: unknown;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type WorldMutationCarrier = Mutable<EngineRunContext> & { __wb_worldMutated: boolean };

function ensureWorldMutationCarrier(ctx: EngineRunContext): WorldMutationCarrier {
  const carrier = ctx as Mutable<EngineRunContext> & {
    __wb_worldMutated?: boolean;
  };

  if (typeof carrier.__wb_worldMutated !== 'boolean') {
    carrier.__wb_worldMutated = false;
  }

  return carrier as WorldMutationCarrier;
}

export function hasWorldBeenMutated(ctx: EngineRunContext): boolean {
  return ensureWorldMutationCarrier(ctx).__wb_worldMutated;
}

function resetWorldMutationFlag(ctx: EngineRunContext): void {
  ensureWorldMutationCarrier(ctx).__wb_worldMutated = false;
}

function markWorldMutated(ctx: EngineRunContext): void {
  ensureWorldMutationCarrier(ctx).__wb_worldMutated = true;
}

export interface RunTickOptions {
  readonly trace?: boolean;
}

export interface RunTickResult {
  readonly world: SimulationWorld;
  readonly trace?: TickTrace;
}

export type PipelineStage = (
  world: SimulationWorld,
  ctx: EngineRunContext
) => SimulationWorld;

const PIPELINE_DEFINITION: ReadonlyArray<readonly [StepName, PipelineStage]> = [
  ['applyDeviceEffects', applyDeviceEffects],
  ['applySensors', applySensors],
  ['updateEnvironment', updateEnvironment],
  ['applyIrrigationAndNutrients', applyIrrigationAndNutrients],
  ['advancePhysiology', advancePhysiology],
  ['applyHarvestAndInventory', applyHarvestAndInventory],
  ['applyEconomyAccrual', applyEconomyAccrual],
  ['commitAndTelemetry', commitAndTelemetry]
];

export const PIPELINE_ORDER: readonly StepName[] = PIPELINE_DEFINITION.map(([name]) => name);

const PIPELINE_STAGE_LOOKUP = new Map<StepName, PipelineStage>(PIPELINE_DEFINITION);

export function resolvePipelineStage(name: StepName): PipelineStage {
  const stage = PIPELINE_STAGE_LOOKUP.get(name);

  if (!stage) {
    throw new Error(`Unknown pipeline stage: ${name}`);
  }

  return stage;
}

export function runTick(
  world: SimulationWorld,
  ctx: EngineRunContext,
  opts: RunTickOptions = {}
): RunTickResult {
  const collector = opts.trace ? createTickTraceCollector() : undefined;
  let nextWorld = world;
  resetWorldMutationFlag(ctx);

  for (const [stepName, stageFn] of PIPELINE_DEFINITION) {
    const inputWorld = nextWorld;

    if (collector) {
      nextWorld = collector.measureStage(stepName, () => stageFn(inputWorld, ctx));
    } else {
      nextWorld = stageFn(inputWorld, ctx);
    }

    if (nextWorld !== inputWorld) {
      markWorldMutated(ctx);
    }

    ctx.instrumentation?.onStageComplete?.(stepName, nextWorld);

    if (stepName === 'applySensors') {
      clearSensorReadingsRuntime(ctx);
    }

    if (stepName === 'applyIrrigationAndNutrients') {
      clearIrrigationNutrientsRuntime(ctx);
    }
  }

  resetWorldMutationFlag(ctx);

  const trace = collector?.finalize();

  return { world: nextWorld, trace } satisfies RunTickResult;
}
