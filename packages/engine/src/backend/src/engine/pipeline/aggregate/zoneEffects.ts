import { FLOAT_TOLERANCE, ROOM_DEFAULT_HEIGHT_M } from '../../../constants/simConstants.ts';
import { MIN_AIR_CHANGES_PER_HOUR } from '../../../constants/climate.ts';
import type { EngineRunContext } from '../../Engine.ts';
import type { Zone } from '../../../domain/world.ts';
import type { DeviceEffectsRuntime } from '../applyDeviceEffects.ts';

export interface ZoneAggregationState {
  readonly zone: Zone;
  readonly ctx: EngineRunContext;
  readonly runtime: DeviceEffectsRuntime;
  readonly effectiveness01: number;
  readonly volume_m3: number;
  readonly totalCoverage_m2: number;
  runningAirflow_m3_per_h: number;
  totalAirflowDelivered_m3_per_h: number;
  totalAirflowReduction_m3_per_h: number;
}

function emitZoneDiagnostic(ctx: EngineRunContext, diagnostic: Parameters<NonNullable<typeof ctx.diagnostics>['emit']>[0]): void {
  ctx.diagnostics?.emit(diagnostic);
}

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

  emitZoneDiagnostic(ctx, {
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

  emitZoneDiagnostic(ctx, {
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

export function initializeZoneAggregation(
  zone: Zone,
  ctx: EngineRunContext,
  runtime: DeviceEffectsRuntime
): ZoneAggregationState {
  const { totalCoverage_m2, effectiveness01 } = computeCoverageTotals(zone);
  const height_m = resolveZoneHeight(zone);
  const volume_m3 = Math.max(0, zone.floorArea_m2) * height_m;
  const demand_m2 = Math.max(0, zone.floorArea_m2);

  runtime.zoneCoverageTotals_m2.set(zone.id, totalCoverage_m2);
  runtime.zoneCoverageEffectiveness01.set(zone.id, effectiveness01);
  runtime.zoneAirflowReductions_m3_per_h.set(zone.id, 0);
  runtime.zoneOdorDelta.set(zone.id, 0);
  runtime.zoneParticulateRemoval_pct.set(zone.id, 0);

  emitCoverageWarning(ctx, zone, totalCoverage_m2, demand_m2, effectiveness01);

  return {
    zone,
    ctx,
    runtime,
    effectiveness01,
    volume_m3,
    totalCoverage_m2,
    runningAirflow_m3_per_h: 0,
    totalAirflowDelivered_m3_per_h: 0,
    totalAirflowReduction_m3_per_h: 0
  } satisfies ZoneAggregationState;
}

export function recordAirflowDelivery(state: ZoneAggregationState, airflow_m3_per_h: number): void {
  if (!Number.isFinite(airflow_m3_per_h) || airflow_m3_per_h <= 0) {
    return;
  }

  state.runningAirflow_m3_per_h += airflow_m3_per_h;
  state.totalAirflowDelivered_m3_per_h += airflow_m3_per_h;
}

export function recordAirflowReduction(state: ZoneAggregationState, reduction_m3_per_h: number): number {
  if (!Number.isFinite(reduction_m3_per_h) || reduction_m3_per_h <= 0) {
    return 0;
  }

  const available = Math.max(0, state.runningAirflow_m3_per_h);
  if (available <= 0) {
    return 0;
  }

  const applied = Math.min(reduction_m3_per_h, available);
  const currentReduction = state.runtime.zoneAirflowReductions_m3_per_h.get(state.zone.id) ?? 0;

  state.runtime.zoneAirflowReductions_m3_per_h.set(state.zone.id, currentReduction + applied);
  state.runningAirflow_m3_per_h = Math.max(0, state.runningAirflow_m3_per_h - applied);
  state.totalAirflowReduction_m3_per_h += applied;

  return applied;
}

export function finalizeZoneAggregation(state: ZoneAggregationState): void {
  const netAirflow_m3_per_h = Math.max(0, state.runningAirflow_m3_per_h);
  const netACH = state.volume_m3 > 0 ? netAirflow_m3_per_h / state.volume_m3 : 0;

  if (state.totalAirflowReduction_m3_per_h > 0 || state.totalAirflowDelivered_m3_per_h > 0) {
    const appliedReduction = Math.min(
      state.totalAirflowDelivered_m3_per_h,
      state.totalAirflowReduction_m3_per_h
    );
    state.runtime.zoneAirflowReductions_m3_per_h.set(state.zone.id, appliedReduction);
  }

  state.runtime.zoneAirflowTotals_m3_per_h.set(state.zone.id, netAirflow_m3_per_h);
  state.runtime.zoneAirChangesPerHour.set(state.zone.id, netACH);

  emitAirflowWarning(state.ctx, state.zone, netAirflow_m3_per_h, netACH, state.volume_m3);
}
