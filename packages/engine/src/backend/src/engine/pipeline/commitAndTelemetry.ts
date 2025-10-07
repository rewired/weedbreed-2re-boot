import { HOURS_PER_TICK } from '../../constants/simConstants.js';
import type { SimulationWorld } from '../../domain/world.js';
import { hasWorldBeenMutated, type EngineRunContext } from '../Engine.js';

export function commitAndTelemetry(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  if (!hasWorldBeenMutated(ctx)) {
    return world;
  }

  return {
    ...world,
    simTimeHours: world.simTimeHours + HOURS_PER_TICK
  } satisfies SimulationWorld;
}
