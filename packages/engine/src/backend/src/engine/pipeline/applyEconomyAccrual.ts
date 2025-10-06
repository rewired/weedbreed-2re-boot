import type { SimulationWorld, WorkforcePayrollState } from '../../domain/world.js';
import type { EngineRunContext } from '../Engine.js';
import { consumeWorkforcePayrollAccrual } from './applyWorkforce.js';
import {
  consumeDeviceMaintenanceAccrual,
  type DeviceMaintenanceAccrualState,
  type DeviceMaintenanceAccrualSnapshot,
} from '../../device/maintenanceRuntime.js';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface WorkforceEconomyAccrualState {
  readonly current?: WorkforcePayrollState;
  readonly finalizedDays: readonly WorkforcePayrollState[];
}

interface DeviceMaintenanceEconomyAccrualState {
  readonly current?: DeviceMaintenanceAccrualState;
  readonly finalizedDays: readonly DeviceMaintenanceAccrualState[];
}

interface EconomyAccrualCarrier extends Mutable<EngineRunContext> {
  economyAccruals?: {
    workforce?: WorkforceEconomyAccrualState;
    deviceMaintenance?: DeviceMaintenanceEconomyAccrualState;
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

function mergeMaintenanceFinalizedDays(
  existing: readonly DeviceMaintenanceAccrualState[],
  finalized?: DeviceMaintenanceAccrualSnapshot['finalized']
): DeviceMaintenanceAccrualState[] {
  if (!finalized || finalized.length === 0) {
    return [...existing];
  }

  const merged = [...existing];

  for (const entry of finalized) {
    const filtered = merged.filter((item) => item.dayIndex !== entry.dayIndex);
    filtered.push(entry);
    merged.splice(0, merged.length, ...filtered.sort((a, b) => a.dayIndex - b.dayIndex));
  }

  return merged;
}

export function applyEconomyAccrual(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const payrollSnapshot = consumeWorkforcePayrollAccrual(ctx);
  const maintenanceSnapshot = consumeDeviceMaintenanceAccrual(ctx);

  if (!payrollSnapshot && !maintenanceSnapshot) {
    return world;
  }

  const carrier = ctx as EconomyAccrualCarrier;
  const economyAccruals = (carrier.economyAccruals ?? {}) as NonNullable<
    EconomyAccrualCarrier['economyAccruals']
  >;

  if (payrollSnapshot) {
    const existingWorkforce = economyAccruals.workforce ?? { finalizedDays: [] };
    const workforceFinalized = mergeFinalizedDays(
      existingWorkforce.finalizedDays ?? [],
      payrollSnapshot.finalized,
    );

    economyAccruals.workforce = {
      current: payrollSnapshot.current,
      finalizedDays: workforceFinalized,
    } satisfies WorkforceEconomyAccrualState;
  }

  if (maintenanceSnapshot) {
    const existingMaintenance = economyAccruals.deviceMaintenance ?? { finalizedDays: [] };
    const finalizedDays = mergeMaintenanceFinalizedDays(
      existingMaintenance.finalizedDays ?? [],
      maintenanceSnapshot.finalized,
    );

    economyAccruals.deviceMaintenance = {
      current: maintenanceSnapshot.current,
      finalizedDays,
    } satisfies DeviceMaintenanceEconomyAccrualState;
  }

  carrier.economyAccruals = economyAccruals;

  return world;
}
