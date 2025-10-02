import type { SimulationWorld } from '../../domain/world.js';
import type { EngineRunContext } from '../Engine.js';

export function applyEconomyAccrual(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  void ctx;

  const nextWorld = { ...world } satisfies SimulationWorld;

  return nextWorld;
}
