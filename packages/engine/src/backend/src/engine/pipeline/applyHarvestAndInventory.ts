import type { SimulationWorld } from '../../domain/world.ts';
import type { EngineRunContext } from '../Engine.ts';

/**
 * Preserves harvest-ready plants until an explicit `plants.harvest.v1` command.
 * The phase remains in the canonical pipeline because its ordering is contractual.
 */
export function applyHarvestAndInventory(
  world: SimulationWorld,
  ctx: EngineRunContext,
): SimulationWorld {
  void ctx;
  return world;
}
