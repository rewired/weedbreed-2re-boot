import { HOURS_PER_TICK } from '../../constants/simConstants.js';
import type { SimulationWorld } from '../../domain/world.js';
import { hasWorldBeenMutated, type EngineRunContext } from '../Engine.js';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export function commitAndTelemetry(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  if (!hasWorldBeenMutated(ctx)) {
    const mutableWorld = world as Mutable<SimulationWorld>;
    mutableWorld.simTimeHours += HOURS_PER_TICK;
    return world;
  }

  return {
    ...world,
    simTimeHours: world.simTimeHours + HOURS_PER_TICK
  } satisfies SimulationWorld;
}
