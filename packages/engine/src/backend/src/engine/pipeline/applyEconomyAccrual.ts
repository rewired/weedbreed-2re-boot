import type { SimulationWorld, WorkforcePayrollState } from '../../domain/world.js';
import type { EngineRunContext } from '../Engine.js';
import { consumeWorkforcePayrollAccrual } from './applyWorkforce.js';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface WorkforceEconomyAccrualState {
  readonly current?: WorkforcePayrollState;
  readonly finalizedDays: readonly WorkforcePayrollState[];
}

interface EconomyAccrualCarrier extends Mutable<EngineRunContext> {
  economyAccruals?: {
    workforce?: WorkforceEconomyAccrualState;
  };
}

function mergeFinalizedDays(
  existing: readonly WorkforcePayrollState[],
  finalized?: WorkforcePayrollState,
): WorkforcePayrollState[] {
  if (!finalized) {
    return [...existing];
  }

  const filtered = existing.filter((entry) => entry.dayIndex !== finalized.dayIndex);
  filtered.push(finalized);
  return filtered.sort((a, b) => a.dayIndex - b.dayIndex);
}

export function applyEconomyAccrual(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const payrollSnapshot = consumeWorkforcePayrollAccrual(ctx);

  if (!payrollSnapshot) {
    return world;
  }

  const carrier = ctx as EconomyAccrualCarrier;
  const existing = carrier.economyAccruals?.workforce ?? { finalizedDays: [] };
  const finalizedDays = mergeFinalizedDays(existing.finalizedDays ?? [], payrollSnapshot.finalized);

  const nextWorkforceAccrual: WorkforceEconomyAccrualState = {
    current: payrollSnapshot.current,
    finalizedDays,
  };

  carrier.economyAccruals = {
    ...carrier.economyAccruals,
    workforce: nextWorkforceAccrual,
  };

  return world;
}
