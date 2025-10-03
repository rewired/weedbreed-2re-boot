import {
  FLOAT_TOLERANCE,
  HOURS_PER_TICK,
  ROOM_DEFAULT_HEIGHT_M
} from '../../constants/simConstants.js';
import type {
  HumidityActuatorInputs,
  LightEmitterInputs,
  ThermalActuatorInputs
} from '../../domain/interfaces/index.js';
import type { ZoneDeviceInstance } from '../../domain/entities.js';
import type { SimulationWorld, Zone } from '../../domain/world.js';
import { createHumidityActuatorStub, createLightEmitterStub, createThermalActuatorStub } from '../../stubs/index.js';
import type { EngineDiagnostic, EngineRunContext } from '../Engine.js';

export interface DeviceEffectsRuntime {
  readonly zoneTemperatureDeltaC: Map<Zone['id'], number>;
  readonly zoneHumidityDeltaPct: Map<Zone['id'], number>;
  readonly zonePPFD_umol_m2s: Map<Zone['id'], number>;
  readonly zoneDLI_mol_m2d_inc: Map<Zone['id'], number>;
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
    zoneHumidityDeltaPct: new Map(),
    zonePPFD_umol_m2s: new Map(),
    zoneDLI_mol_m2d_inc: new Map(),
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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
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

/**
 * Accumulates relative humidity deltas for a zone within the runtime maps.
 */
function accumulateHumidityDelta(
  runtime: DeviceEffectsRuntime,
  zoneId: Zone['id'],
  deltaPct: number
): void {
  if (!Number.isFinite(deltaPct) || deltaPct === 0) {
    return;
  }

  const current = runtime.zoneHumidityDeltaPct.get(zoneId) ?? 0;
  runtime.zoneHumidityDeltaPct.set(zoneId, current + deltaPct);
}

/**
 * Accumulates photosynthetic photon flux density contributions for a zone.
 */
function accumulatePPFD(
  runtime: DeviceEffectsRuntime,
  zoneId: Zone['id'],
  ppfd: number
): void {
  if (!Number.isFinite(ppfd) || ppfd === 0) {
    return;
  }

  const current = runtime.zonePPFD_umol_m2s.get(zoneId) ?? 0;
  runtime.zonePPFD_umol_m2s.set(zoneId, current + ppfd);
}

/**
 * Accumulates daily light integral increments for a zone.
 */
function accumulateDLI(
  runtime: DeviceEffectsRuntime,
  zoneId: Zone['id'],
  dli: number
): void {
  if (!Number.isFinite(dli) || dli === 0) {
    return;
  }

  const current = runtime.zoneDLI_mol_m2d_inc.get(zoneId) ?? 0;
  runtime.zoneDLI_mol_m2d_inc.set(zoneId, current + dli);
}

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

/**
 * Derives thermal actuator inputs based on the device instance fields.
 *
 * Phase 1 simplification: mode selection hinges on sensible heat removal
 * capacity being available. Devices without cooling capacity operate in waste
 * heat mode.
 */
function deriveThermalInputs(
  device: ZoneDeviceInstance
): ThermalActuatorInputs | null {
  const power_W = Number.isFinite(device.powerDraw_W) ? device.powerDraw_W : 0;
  const duty01 = clamp01(Number.isFinite(device.dutyCycle01) ? device.dutyCycle01 : 0);

  if (power_W <= 0 || duty01 <= 0) {
    return null;
  }

  const efficiency01 = clamp01(
    Number.isFinite(device.efficiency01) ? device.efficiency01 : 0
  );
  const maxCool_W = Number.isFinite(device.sensibleHeatRemovalCapacity_W)
    ? device.sensibleHeatRemovalCapacity_W
    : 0;
  const effectivePower_W = power_W * duty01;

  if (maxCool_W > 0) {
    return {
      power_W: effectivePower_W,
      efficiency01,
      mode: 'cool',
      max_cool_W: maxCool_W * duty01
    } satisfies ThermalActuatorInputs;
  }

  return {
    power_W: effectivePower_W,
    efficiency01,
    mode: 'heat'
  } satisfies ThermalActuatorInputs;
}

/**
 * Derives humidity actuator inputs using heuristic slug classification.
 *
 * Phase 1 simplification: relies on slug/name matching while blueprint-driven
 * configuration is scheduled for a subsequent phase.
 */
function deriveHumidityInputs(
  device: ZoneDeviceInstance
): HumidityActuatorInputs | null {
  const slug = (device.slug ?? '').toLowerCase();
  const name = (device.name ?? '').toLowerCase();
  const duty01 = clamp01(Number.isFinite(device.dutyCycle01) ? device.dutyCycle01 : 0);

  if (duty01 <= 0) {
    return null;
  }

  if (slug.includes('dehumid') || name.includes('dehumid')) {
    return {
      mode: 'dehumidify',
      capacity_g_per_h: 500 * duty01
    } satisfies HumidityActuatorInputs; // TODO: Replace heuristic in Phase 2
  }

  if (slug.includes('humid') || name.includes('humid')) {
    return {
      mode: 'humidify',
      capacity_g_per_h: 300 * duty01
    } satisfies HumidityActuatorInputs; // TODO: Replace heuristic in Phase 2
  }

  return null;
}

/**
 * Derives light emitter inputs assuming a constant photon efficacy.
 *
 * Phase 1 simplification: infers PPFD from electrical power draw, coverage,
 * and duty cycle while awaiting blueprint integration.
 */
function deriveLightingInputs(
  device: ZoneDeviceInstance
): LightEmitterInputs | null {
  const coverage_m2 = Number.isFinite(device.coverage_m2)
    ? device.coverage_m2
    : 0;
  const power_W = Number.isFinite(device.powerDraw_W) ? device.powerDraw_W : 0;

  if (coverage_m2 <= 0 || power_W <= 0) {
    return null;
  }

  const efficiency01 = clamp01(
    Number.isFinite(device.efficiency01) ? device.efficiency01 : 0
  );
  const dim01 = clamp01(Number.isFinite(device.dutyCycle01) ? device.dutyCycle01 : 0);
  const photonEfficacy_umol_per_J = 2.5; // TODO: Blueprint-sourced value
  const ppfd_center_umol_m2s = power_W * efficiency01 * photonEfficacy_umol_per_J;

  if (ppfd_center_umol_m2s <= 0) {
    return null;
  }

  return {
    ppfd_center_umol_m2s,
    coverage_m2,
    dim01
  } satisfies LightEmitterInputs;
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
          const thermalInputs = deriveThermalInputs(device);
          if (thermalInputs) {
            const thermalStub = createThermalActuatorStub();
            const { deltaT_K } = thermalStub.computeEffect(
              thermalInputs,
              zone.environment,
              zone.airMass_kg,
              tickHours
            );
            accumulateTemperatureDelta(
              runtime,
              zone.id,
              deltaT_K * effectiveness01
            );
          }

          const humidityInputs = deriveHumidityInputs(device);
          if (humidityInputs) {
            const humidityStub = createHumidityActuatorStub();
            const { deltaRH_pct } = humidityStub.computeEffect(
              humidityInputs,
              zone.environment,
              zone.airMass_kg,
              tickHours
            );
            accumulateHumidityDelta(runtime, zone.id, deltaRH_pct);
          }

          const lightingInputs = deriveLightingInputs(device);
          if (lightingInputs) {
            const lightingStub = createLightEmitterStub();
            const { ppfd_effective_umol_m2s, dli_mol_m2d_inc } =
              lightingStub.computeEffect(lightingInputs, tickHours);
            accumulatePPFD(runtime, zone.id, ppfd_effective_umol_m2s);
            accumulateDLI(runtime, zone.id, dli_mol_m2d_inc);
          }
        }
      }
    }
  }

  return world;
}
