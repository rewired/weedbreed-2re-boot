import type { EngineRunContext } from '../engine/Engine.js';
import type {
  DeviceMaintenanceTaskPlan,
  DeviceMaintenanceCompletion,
  DeviceReplacementRecommendation
} from './degradation.js';

const DEVICE_MAINTENANCE_RUNTIME_KEY = '__wb_deviceMaintenanceRuntime' as const;
const DEVICE_MAINTENANCE_ACCRUAL_KEY = '__wb_deviceMaintenanceAccrual' as const;

type DeviceMaintenanceRuntimeMutable = {
  scheduledTasks: DeviceMaintenanceTaskPlan[];
  completedTasks: DeviceMaintenanceCompletion[];
  replacements: DeviceReplacementRecommendation[];
};

type DeviceMaintenanceRuntimeCarrier = EngineRunContext & {
  [DEVICE_MAINTENANCE_RUNTIME_KEY]?: DeviceMaintenanceRuntimeMutable;
};

type DeviceMaintenanceAccrualCarrier = EngineRunContext & {
  [DEVICE_MAINTENANCE_ACCRUAL_KEY]?: DeviceMaintenanceAccrualSnapshot;
};

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

export function ensureDeviceMaintenanceRuntime(ctx: EngineRunContext): DeviceMaintenanceRuntimeMutable {
  const carrier = ctx as DeviceMaintenanceRuntimeCarrier;
  if (!carrier[DEVICE_MAINTENANCE_RUNTIME_KEY]) {
    carrier[DEVICE_MAINTENANCE_RUNTIME_KEY] = {
      scheduledTasks: [],
      completedTasks: [],
      replacements: []
    } satisfies DeviceMaintenanceRuntimeMutable;
  }

  return carrier[DEVICE_MAINTENANCE_RUNTIME_KEY] as DeviceMaintenanceRuntimeMutable;
}

export function consumeDeviceMaintenanceRuntime(ctx: EngineRunContext): DeviceMaintenanceRuntime | undefined {
  const carrier = ctx as DeviceMaintenanceRuntimeCarrier;
  const runtime = carrier[DEVICE_MAINTENANCE_RUNTIME_KEY];

  if (!runtime) {
    return undefined;
  }

  const snapshot: DeviceMaintenanceRuntime = {
    scheduledTasks: [...runtime.scheduledTasks],
    completedTasks: [...runtime.completedTasks],
    replacements: [...runtime.replacements]
  } satisfies DeviceMaintenanceRuntime;

  delete carrier[DEVICE_MAINTENANCE_RUNTIME_KEY];

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

  const carrier = ctx as DeviceMaintenanceAccrualCarrier;
  const existing = carrier[DEVICE_MAINTENANCE_ACCRUAL_KEY];
  const hours = Math.max(0, tickHours);
  const costPerHourIncrement = costIncrementCc / hours;

  if (!existing) {
    carrier[DEVICE_MAINTENANCE_ACCRUAL_KEY] = {
      current: {
        dayIndex,
        costCc: costIncrementCc,
        costCc_per_h: costPerHourIncrement,
        hoursAccrued: hours
      }
    } satisfies DeviceMaintenanceAccrualSnapshot;
    return;
  }

  const current = existing.current;

  if (current.dayIndex === dayIndex) {
    const nextCost = current.costCc + costIncrementCc;
    const nextHours = current.hoursAccrued + hours;
    carrier[DEVICE_MAINTENANCE_ACCRUAL_KEY] = {
      current: {
        dayIndex,
        costCc: nextCost,
        costCc_per_h: nextHours > 0 ? nextCost / nextHours : 0,
        hoursAccrued: nextHours
      },
      finalized: existing.finalized
    } satisfies DeviceMaintenanceAccrualSnapshot;
    return;
  }

  const finalized = existing.finalized ? [...existing.finalized, current] : [current];

  carrier[DEVICE_MAINTENANCE_ACCRUAL_KEY] = {
    current: {
      dayIndex,
      costCc: costIncrementCc,
      costCc_per_h: costPerHourIncrement,
      hoursAccrued: hours
    },
    finalized
  } satisfies DeviceMaintenanceAccrualSnapshot;
}

export function consumeDeviceMaintenanceAccrual(
  ctx: EngineRunContext
): DeviceMaintenanceAccrualSnapshot | undefined {
  const carrier = ctx as DeviceMaintenanceAccrualCarrier;
  const snapshot = carrier[DEVICE_MAINTENANCE_ACCRUAL_KEY];

  if (!snapshot) {
    return undefined;
  }

  const finalized = snapshot.finalized ? [...snapshot.finalized] : undefined;

  if (finalized && finalized.length > 0) {
    carrier[DEVICE_MAINTENANCE_ACCRUAL_KEY] = {
      current: snapshot.current
    } satisfies DeviceMaintenanceAccrualSnapshot;
  }

  return {
    current: snapshot.current,
    finalized
  } satisfies DeviceMaintenanceAccrualSnapshot;
}
