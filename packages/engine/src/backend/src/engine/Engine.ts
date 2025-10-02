import type { SimulationWorld, Uuid } from '../domain/world.js';
import { applyDeviceEffects } from './pipeline/applyDeviceEffects.js';
import { updateEnvironment } from './pipeline/updateEnvironment.js';
import { applyIrrigationAndNutrients } from './pipeline/applyIrrigationAndNutrients.js';
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
  readonly [key: string]: unknown;
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
  ['updateEnvironment', updateEnvironment],
  ['applyIrrigationAndNutrients', applyIrrigationAndNutrients],
  ['advancePhysiology', advancePhysiology],
  ['applyHarvestAndInventory', applyHarvestAndInventory],
  ['applyEconomyAccrual', applyEconomyAccrual],
  ['commitAndTelemetry', commitAndTelemetry]
];

export const PIPELINE_ORDER: readonly StepName[] = PIPELINE_DEFINITION.map(([name]) => name);

export function runTick(
  world: SimulationWorld,
  ctx: EngineRunContext,
  opts: RunTickOptions = {}
): RunTickResult {
  const collector = opts.trace ? createTickTraceCollector() : undefined;
  let nextWorld = world;

  for (const [stepName, stageFn] of PIPELINE_DEFINITION) {
    if (collector) {
      nextWorld = collector.measureStage(stepName, () => stageFn(nextWorld, ctx));
    } else {
      nextWorld = stageFn(nextWorld, ctx);
    }

    ctx.instrumentation?.onStageComplete?.(stepName, nextWorld);
  }

  const trace = collector?.finalize();

  return { world: nextWorld, trace } satisfies RunTickResult;
}
