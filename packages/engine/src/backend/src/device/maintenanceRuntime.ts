import type { EngineRunContext } from '../engine/Engine.ts';
import type {
  DeviceMaintenanceTaskPlan,
  DeviceMaintenanceCompletion,
  DeviceReplacementRecommendation
} from './degradation.ts';

const deviceMaintenanceRuntimeStore = new WeakMap<EngineRunContext, DeviceMaintenanceRuntimeMutable>();
const deviceMaintenanceAccrualStore = new WeakMap<EngineRunContext, DeviceMaintenanceAccrualSnapshot>();

interface DeviceMaintenanceRuntimeMutable {
  scheduledTasks: DeviceMaintenanceTaskPlan[];
  completedTasks: DeviceMaintenanceCompletion[];
  replacements: DeviceReplacementRecommendation[];
}

export interface DeviceMaintenanceRuntime {
  readonly scheduledTasks: readonly DeviceMaintenanceTaskPlan[];
  readonly completedTasks: readonly DeviceMaintenanceCompletion[];
  readonly replacements: readonly DeviceReplacementRecommendation[];
}

export interface DeviceMaintenanceAccrualState {
  readonly dayIndex: number;
  readonly costCc: number;
  readonly costCc_per_h: number;
  readonly hoursAccrued: number;
}

export interface DeviceMaintenanceAccrualSnapshot {
  readonly current: DeviceMaintenanceAccrualState;
  readonly finalized?: readonly DeviceMaintenanceAccrualState[];
}

/**
 * Establishes maintenance runtime state for the tick while respecting SEC §2 explicit state requirements.
 */
export function ensureDeviceMaintenanceRuntime(ctx: EngineRunContext): DeviceMaintenanceRuntimeMutable {
  const existing = deviceMaintenanceRuntimeStore.get(ctx);

  if (existing) {
    return existing;
  }

  const runtime: DeviceMaintenanceRuntimeMutable = {
    scheduledTasks: [],
    completedTasks: [],
    replacements: [],
  } satisfies DeviceMaintenanceRuntimeMutable;

  deviceMaintenanceRuntimeStore.set(ctx, runtime);
  return runtime;
}

/**
 * Produces an immutable snapshot of maintenance runtime data and clears the underlying store (SEC §2).
 */
export function consumeDeviceMaintenanceRuntime(ctx: EngineRunContext): DeviceMaintenanceRuntime | undefined {
  const runtime = deviceMaintenanceRuntimeStore.get(ctx);

  if (!runtime) {
    return undefined;
  }

  const snapshot: DeviceMaintenanceRuntime = {
    scheduledTasks: [...runtime.scheduledTasks],
    completedTasks: [...runtime.completedTasks],
    replacements: [...runtime.replacements]
  } satisfies DeviceMaintenanceRuntime;

  deviceMaintenanceRuntimeStore.delete(ctx);

  return snapshot;
}

export function updateDeviceMaintenanceAccrual(
  ctx: EngineRunContext,
  dayIndex: number,
  tickHours: number,
  costIncrementCc: number
): void {
  if (!Number.isFinite(costIncrementCc) || costIncrementCc === 0) {
    return;
  }

  if (!Number.isFinite(tickHours) || tickHours <= 0) {
    return;
  }

  const existing = deviceMaintenanceAccrualStore.get(ctx);
  const hours = Math.max(0, tickHours);
  const costPerHourIncrement = costIncrementCc / hours;

  if (!existing) {
    deviceMaintenanceAccrualStore.set(ctx, {
      current: {
        dayIndex,
        costCc: costIncrementCc,
        costCc_per_h: costPerHourIncrement,
        hoursAccrued: hours
      }
    } satisfies DeviceMaintenanceAccrualSnapshot);
    return;
  }

  const current = existing.current;

  if (current.dayIndex === dayIndex) {
    const nextCost = current.costCc + costIncrementCc;
    const nextHours = current.hoursAccrued + hours;
    deviceMaintenanceAccrualStore.set(ctx, {
      current: {
        dayIndex,
        costCc: nextCost,
        costCc_per_h: nextHours > 0 ? nextCost / nextHours : 0,
        hoursAccrued: nextHours
      },
      finalized: existing.finalized
    } satisfies DeviceMaintenanceAccrualSnapshot);
    return;
  }

  const finalized = existing.finalized ? [...existing.finalized, current] : [current];

  deviceMaintenanceAccrualStore.set(ctx, {
    current: {
      dayIndex,
      costCc: costIncrementCc,
      costCc_per_h: costPerHourIncrement,
      hoursAccrued: hours
    },
    finalized
  } satisfies DeviceMaintenanceAccrualSnapshot);
}

/**
 * Returns the pending maintenance accrual snapshot and resets finalized entries to honour SEC §2 tick isolation.
 */
export function consumeDeviceMaintenanceAccrual(
  ctx: EngineRunContext
): DeviceMaintenanceAccrualSnapshot | undefined {
  const snapshot = deviceMaintenanceAccrualStore.get(ctx);

  if (!snapshot) {
    return undefined;
  }

  const finalized = snapshot.finalized ? [...snapshot.finalized] : undefined;

  if (finalized && finalized.length > 0) {
    deviceMaintenanceAccrualStore.set(ctx, {
      current: snapshot.current
    } satisfies DeviceMaintenanceAccrualSnapshot);
  }

  return {
    current: snapshot.current,
    finalized
  } satisfies DeviceMaintenanceAccrualSnapshot;
}
