import { HOURS_PER_TICK } from '../../constants/simConstants.ts';
import type { SimulationWorld } from '../../domain/world.ts';
import { hasWorldBeenMutated, type EngineRunContext } from '../Engine.ts';

export function commitAndTelemetry(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  if (!hasWorldBeenMutated(ctx)) {
    return world;
  }

  return {
    ...world,
    simTimeHours: world.simTimeHours + HOURS_PER_TICK
  } satisfies SimulationWorld;
}
