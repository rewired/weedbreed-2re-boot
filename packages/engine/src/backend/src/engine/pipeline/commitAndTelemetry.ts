import { HOURS_PER_TICK } from '../../constants/simConstants.js';
import type { SimulationWorld } from '../../domain/world.js';
import type { EngineRunContext } from '../Engine.js';

type MutableSimulationWorld = Omit<SimulationWorld, 'simTimeHours'> & {
  simTimeHours: number;
};

export function commitAndTelemetry(world: SimulationWorld, ctx: EngineRunContext): void {
  void ctx;

  const mutableWorld = world as MutableSimulationWorld;
  mutableWorld.simTimeHours += HOURS_PER_TICK;
}
