import { HOURS_PER_TICK, ROOM_DEFAULT_HEIGHT_M } from '../../constants/simConstants.js';
import type { SimulationWorld, Zone } from '../../domain/world.js';
import type { EngineDiagnostic, EngineRunContext } from '../Engine.js';
import { applyDeviceHeat } from '../thermo/heat.js';

export interface DeviceEffectsRuntime {
  readonly zoneTemperatureDeltaC: Map<Zone['id'], number>;
  readonly zoneCoverageTotals_m2: Map<Zone['id'], number>;
  readonly zoneAirflowTotals_m3_per_h: Map<Zone['id'], number>;
  readonly zoneCoverageEffectiveness01: Map<Zone['id'], number>;
  readonly zoneAirChangesPerHour: Map<Zone['id'], number>;
}

const DEVICE_EFFECTS_CONTEXT_KEY = '__wb_deviceEffects' as const;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type DeviceEffectsCarrier = Mutable<EngineRunContext> & {
  [DEVICE_EFFECTS_CONTEXT_KEY]?: DeviceEffectsRuntime;
};

function setDeviceEffectsRuntime(
  ctx: EngineRunContext,
  runtime: DeviceEffectsRuntime
): DeviceEffectsRuntime {
  (ctx as DeviceEffectsCarrier)[DEVICE_EFFECTS_CONTEXT_KEY] = runtime;
  return runtime;
}

export function ensureDeviceEffectsRuntime(ctx: EngineRunContext): DeviceEffectsRuntime {
  return setDeviceEffectsRuntime(ctx, {
    zoneTemperatureDeltaC: new Map(),
    zoneCoverageTotals_m2: new Map(),
    zoneAirflowTotals_m3_per_h: new Map(),
    zoneCoverageEffectiveness01: new Map(),
    zoneAirChangesPerHour: new Map()
  });
}

export function getDeviceEffectsRuntime(
  ctx: EngineRunContext
): DeviceEffectsRuntime | undefined {
  return (ctx as DeviceEffectsCarrier)[DEVICE_EFFECTS_CONTEXT_KEY];
}

export function clearDeviceEffectsRuntime(ctx: EngineRunContext): void {
  delete (ctx as DeviceEffectsCarrier)[DEVICE_EFFECTS_CONTEXT_KEY];
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function resolveTickHours(ctx: EngineRunContext): number {
  const candidate =
    (ctx as { tickDurationHours?: unknown }).tickDurationHours ??
    (ctx as { tickHours?: unknown }).tickHours;

  if (isPositiveFinite(candidate)) {
    return candidate;
  }

  return HOURS_PER_TICK;
}

function accumulateTemperatureDelta(
  runtime: DeviceEffectsRuntime,
  zoneId: Zone['id'],
  deltaC: number
): void {
  if (!Number.isFinite(deltaC) || deltaC === 0) {
    return;
  }

  const current = runtime.zoneTemperatureDeltaC.get(zoneId) ?? 0;
  runtime.zoneTemperatureDeltaC.set(zoneId, current + deltaC);
}

const FLOAT_TOLERANCE = 1e-6;
const MIN_AIR_CHANGES_PER_HOUR = 1;

function resolveZoneHeight(zone: Zone): number {
  if (Number.isFinite(zone.height_m) && zone.height_m > 0) {
    return zone.height_m;
  }

  return ROOM_DEFAULT_HEIGHT_M;
}

function computeCoverageTotals(zone: Zone): {
  readonly totalCoverage_m2: number;
  readonly effectiveness01: number;
} {
  const demand_m2 = Math.max(0, zone.floorArea_m2);
  const totalCoverage_m2 = zone.devices.reduce((sum, device) => {
    if (!Number.isFinite(device.coverage_m2) || device.coverage_m2 <= 0) {
      return sum;
    }

    return sum + device.coverage_m2;
  }, 0);

  if (demand_m2 <= 0) {
    return { totalCoverage_m2, effectiveness01: 1 };
  }

  const ratio = totalCoverage_m2 / demand_m2;
  const effectiveness01 = Math.min(1, Math.max(0, ratio));

  return { totalCoverage_m2, effectiveness01 };
}

function computeAirflowMetrics(zone: Zone): {
  readonly totalAirflow_m3_per_h: number;
  readonly ach: number;
} {
  const totalAirflow_m3_per_h = zone.devices.reduce((sum, device) => {
    if (!Number.isFinite(device.airflow_m3_per_h) || device.airflow_m3_per_h <= 0) {
      return sum;
    }

    return sum + device.airflow_m3_per_h;
  }, 0);

  const height_m = resolveZoneHeight(zone);
  const volume_m3 = Math.max(0, zone.floorArea_m2) * height_m;

  if (volume_m3 <= 0) {
    return { totalAirflow_m3_per_h, ach: 0 };
  }

  return {
    totalAirflow_m3_per_h,
    ach: totalAirflow_m3_per_h / volume_m3
  };
}

function emitDiagnostic(ctx: EngineRunContext, diagnostic: EngineDiagnostic): void {
  ctx.diagnostics?.emit(diagnostic);
}

function emitCoverageWarning(
  ctx: EngineRunContext,
  zone: Zone,
  totalCoverage_m2: number,
  demand_m2: number,
  effectiveness01: number
): void {
  if (effectiveness01 + FLOAT_TOLERANCE >= 1) {
    return;
  }

  emitDiagnostic(ctx, {
    scope: 'zone',
    code: 'zone.capacity.coverage.warn',
    zoneId: zone.id,
    message: `Zone "${zone.name}" coverage shortfall: ${totalCoverage_m2.toFixed(2)} m² < ${demand_m2.toFixed(2)} m².`,
    metadata: {
      zoneSlug: zone.slug,
      coverage_m2: totalCoverage_m2,
      demand_m2,
      effectiveness01
    }
  });
}

function emitAirflowWarning(
  ctx: EngineRunContext,
  zone: Zone,
  totalAirflow_m3_per_h: number,
  ach: number,
  volume_m3: number
): void {
  if (ach + FLOAT_TOLERANCE >= MIN_AIR_CHANGES_PER_HOUR) {
    return;
  }

  emitDiagnostic(ctx, {
    scope: 'zone',
    code: 'zone.capacity.airflow.warn',
    zoneId: zone.id,
    message: `Zone "${zone.name}" airflow shortfall: ${ach.toFixed(2)} ACH < ${MIN_AIR_CHANGES_PER_HOUR.toFixed(2)} ACH target.`,
    metadata: {
      zoneSlug: zone.slug,
      airflow_m3_per_h: totalAirflow_m3_per_h,
      ach,
      volume_m3,
      targetAch: MIN_AIR_CHANGES_PER_HOUR
    }
  });
}

export function applyDeviceEffects(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const tickHours = resolveTickHours(ctx);
  const runtime = ensureDeviceEffectsRuntime(ctx);

  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      for (const zone of room.zones) {
        const { totalCoverage_m2, effectiveness01 } = computeCoverageTotals(zone);
        const { totalAirflow_m3_per_h, ach } = computeAirflowMetrics(zone);
        const height_m = resolveZoneHeight(zone);
        const volume_m3 = Math.max(0, zone.floorArea_m2) * height_m;

        runtime.zoneCoverageTotals_m2.set(zone.id, totalCoverage_m2);
        runtime.zoneCoverageEffectiveness01.set(zone.id, effectiveness01);
        runtime.zoneAirflowTotals_m3_per_h.set(zone.id, totalAirflow_m3_per_h);
        runtime.zoneAirChangesPerHour.set(zone.id, ach);

        emitCoverageWarning(ctx, zone, totalCoverage_m2, Math.max(0, zone.floorArea_m2), effectiveness01);
        emitAirflowWarning(ctx, zone, totalAirflow_m3_per_h, ach, volume_m3);

        for (const device of zone.devices) {
          const deltaC = applyDeviceHeat(zone, device, tickHours) * effectiveness01;
          accumulateTemperatureDelta(runtime, zone.id, deltaC);
        }
      }
    }
  }

  return world;
}
