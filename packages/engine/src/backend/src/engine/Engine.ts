import type { SimulationWorld } from '../domain/world.js';
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

export interface EngineRunContext {
  readonly instrumentation?: EngineInstrumentation;
  readonly [key: string]: unknown;
}

export interface RunTickOptions {
  readonly trace?: boolean;
}

export type PipelineStage = (world: SimulationWorld, ctx: EngineRunContext) => void;

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
): TickTrace | undefined {
  const collector = opts.trace ? createTickTraceCollector() : undefined;

  for (const [stepName, stageFn] of PIPELINE_DEFINITION) {
    if (collector) {
      collector.measureStage(stepName, () => stageFn(world, ctx));
    } else {
      stageFn(world, ctx);
    }

    ctx.instrumentation?.onStageComplete?.(stepName, world);
  }

  return collector?.finalize();
}
