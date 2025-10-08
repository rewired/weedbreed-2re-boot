import {
  CP_AIR_J_PER_KG_K,
  FLOAT_TOLERANCE,
  LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG,
  ROOM_DEFAULT_HEIGHT_M,
  HOURS_PER_DAY
} from '../../constants/simConstants.ts';
import type {
  AirflowActuatorInputs,
  Co2InjectorInputs,
  FiltrationUnitInputs,
  HumidityActuatorInputs,
  LightEmitterInputs,
  ThermalActuatorInputs
} from '../../domain/interfaces/index.ts';
import type { ZoneDeviceInstance } from '../../domain/entities.ts';
import type { SimulationWorld, Zone, Room, Structure } from '../../domain/world.ts';
import {
  createAirflowActuatorStub,
  createCo2InjectorStub,
  createFiltrationStub,
  createHumidityActuatorStub,
  createLightEmitterStub,
  createThermalActuatorStub
} from '../../stubs/index.ts';
import type { EngineDiagnostic, EngineRunContext } from '../Engine.ts';
import { resolveTickHours } from '../resolveTickHours.ts';
import { clamp01 } from '../../util/math.ts';
import {
  updateZoneDeviceLifecycle,
  type DeviceDegradationOutcome
} from '../../device/degradation.ts';
import {
  ensureDeviceMaintenanceRuntime,
  updateDeviceMaintenanceAccrual
} from '../../device/maintenanceRuntime.ts';
import { accumulateEnergyConsumption } from '../../economy/runtime.ts';

export interface DeviceEffectsRuntime {
  readonly zoneTemperatureDeltaC: Map<Zone['id'], number>;
  readonly zoneHumidityDeltaPct: Map<Zone['id'], number>;
  readonly zonePPFD_umol_m2s: Map<Zone['id'], number>;
  readonly zoneDLI_mol_m2d_inc: Map<Zone['id'], number>;
  readonly zoneCo2Delta_ppm: Map<Zone['id'], number>;
  readonly zoneCoverageTotals_m2: Map<Zone['id'], number>;
  readonly zoneAirflowTotals_m3_per_h: Map<Zone['id'], number>;
  readonly zoneCoverageEffectiveness01: Map<Zone['id'], number>;
  readonly zoneAirChangesPerHour: Map<Zone['id'], number>;
  readonly zoneAirflowReductions_m3_per_h: Map<Zone['id'], number>;
  readonly zoneOdorDelta: Map<Zone['id'], number>;
  readonly zoneParticulateRemoval_pct: Map<Zone['id'], number>;
}

const DEVICE_EFFECTS_CONTEXT_KEY = '__wb_deviceEffects' as const;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type DeviceEffectsCarrier = Mutable<EngineRunContext> & {
  [DEVICE_EFFECTS_CONTEXT_KEY]?: DeviceEffectsRuntime;
};

const GRAMS_PER_KG = 1_000;

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
    zoneCo2Delta_ppm: new Map(),
    zoneCoverageTotals_m2: new Map(),
    zoneAirflowTotals_m3_per_h: new Map(),
    zoneCoverageEffectiveness01: new Map(),
    zoneAirChangesPerHour: new Map(),
    zoneAirflowReductions_m3_per_h: new Map(),
    zoneOdorDelta: new Map(),
    zoneParticulateRemoval_pct: new Map()
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

function resolveLatentDisposition(
  thermalInputs: ThermalActuatorInputs | null,
  thermalDeltaK: number
): -1 | 0 | 1 {
  if (thermalInputs) {
    if (thermalInputs.mode === 'cool') {
      return -1;
    }

    if (thermalInputs.mode === 'heat') {
      return 1;
    }

    if (thermalInputs.mode === 'auto') {
      if (thermalDeltaK < 0) {
        return -1;
      }

      if (thermalDeltaK > 0) {
        return 1;
      }

      return 0;
    }
  }

  return 1;
}

function computeLatentTemperatureDelta(
  water_g: number,
  airMass_kg: number,
  effectiveness01: number,
  thermalInputs: ThermalActuatorInputs | null,
  thermalDeltaK: number
): number {
  if (!Number.isFinite(water_g) || water_g === 0) {
    return 0;
  }

  if (!Number.isFinite(airMass_kg) || airMass_kg <= 0) {
    return 0;
  }

  if (!Number.isFinite(effectiveness01) || effectiveness01 <= 0) {
    return 0;
  }

  const disposition = resolveLatentDisposition(thermalInputs, thermalDeltaK);

  if (disposition === 0) {
    return 0;
  }

  const latentHeat_J =
    (water_g / GRAMS_PER_KG) *
    LATENT_HEAT_VAPORIZATION_WATER_J_PER_KG *
    disposition;

  const deltaK = latentHeat_J / (airMass_kg * CP_AIR_J_PER_KG_K);

  if (!Number.isFinite(deltaK) || deltaK === 0) {
    return 0;
  }

  return deltaK * effectiveness01;
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

function accumulateCo2Delta(
  runtime: DeviceEffectsRuntime,
  zoneId: Zone['id'],
  delta_ppm: number
): void {
  if (!Number.isFinite(delta_ppm) || delta_ppm === 0) {
    return;
  }

  const current = runtime.zoneCo2Delta_ppm.get(zoneId) ?? 0;
  runtime.zoneCo2Delta_ppm.set(zoneId, current + delta_ppm);
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
 * Derives thermal actuator inputs favouring blueprint-provided configuration
 * and falling back to legacy sensible-heat heuristics when unavailable.
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
  const effectivePower_W = power_W * duty01;
  const effects = device.effects ?? [];

  if (effects.includes('thermal') && device.effectConfigs?.thermal) {
    const config = device.effectConfigs.thermal;
    const inputs: ThermalActuatorInputs = {
      power_W: effectivePower_W,
      efficiency01,
      mode: config.mode
    };

    if (typeof config.max_heat_W === 'number') {
      inputs.max_heat_W = config.max_heat_W * duty01;
    }

    if (typeof config.max_cool_W === 'number') {
      inputs.max_cool_W = config.max_cool_W * duty01;
    }

    if (typeof config.setpoint_C === 'number') {
      inputs.setpoint_C = config.setpoint_C;
    }

    return inputs;
  }

  const maxCool_W = Number.isFinite(device.sensibleHeatRemovalCapacity_W)
    ? device.sensibleHeatRemovalCapacity_W
    : 0;

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
 * Derives humidity actuator inputs preferring explicit blueprint configuration
 * with slug/name heuristics for legacy devices lacking effects metadata.
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

  const effects = device.effects ?? [];

  if (effects.includes('humidity') && device.effectConfigs?.humidity) {
    const config = device.effectConfigs.humidity;

    if (!Number.isFinite(config.capacity_g_per_h) || config.capacity_g_per_h <= 0) {
      return null;
    }

    return {
      mode: config.mode,
      capacity_g_per_h: config.capacity_g_per_h * duty01
    } satisfies HumidityActuatorInputs;
  }

  if (slug.includes('dehumid') || name.includes('dehumid')) {
    return {
      mode: 'dehumidify',
      capacity_g_per_h: 500 * duty01
    } satisfies HumidityActuatorInputs; // Legacy heuristic
  }

  if (slug.includes('humid') || name.includes('humid')) {
    return {
      mode: 'humidify',
      capacity_g_per_h: 300 * duty01
    } satisfies HumidityActuatorInputs; // Legacy heuristic
  }

  return null;
}

/**
 * Derives light emitter inputs prioritising explicit blueprint configuration
 * with power-based heuristics for legacy devices lacking lighting metadata.
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
  const effects = device.effects ?? [];

  if (effects.includes('lighting') && device.effectConfigs?.lighting) {
    const config = device.effectConfigs.lighting;

    if (!Number.isFinite(config.ppfd_center_umol_m2s) || config.ppfd_center_umol_m2s <= 0) {
      return null;
    }

    return {
      ppfd_center_umol_m2s: config.ppfd_center_umol_m2s,
      coverage_m2,
      dim01
    } satisfies LightEmitterInputs;
  }

  const photonEfficacy_umol_per_J = 2.5; // Legacy heuristic until all blueprints migrate
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

function deriveAirflowInputs(device: ZoneDeviceInstance): AirflowActuatorInputs | null {
  const effects = device.effects ?? [];
  const duty01 = clamp01(Number.isFinite(device.dutyCycle01) ? device.dutyCycle01 : 0);

  if (duty01 <= 0) {
    return null;
  }

  if (effects.includes('airflow') && device.effectConfigs?.airflow) {
    const config = device.effectConfigs.airflow;

    if (!Number.isFinite(config.airflow_m3_per_h) || config.airflow_m3_per_h <= 0) {
      return null;
    }

    return {
      airflow_m3_per_h: config.airflow_m3_per_h,
      mode: config.mode,
      dutyCycle01: duty01
    } satisfies AirflowActuatorInputs;
  }

  const legacyAirflow = Number.isFinite(device.airflow_m3_per_h) ? device.airflow_m3_per_h : 0;

  if (legacyAirflow <= 0) {
    return null;
  }

  return {
    airflow_m3_per_h: legacyAirflow,
    mode: 'exhaust',
    dutyCycle01: duty01
  } satisfies AirflowActuatorInputs;
}

function deriveCo2Inputs(device: ZoneDeviceInstance): Co2InjectorInputs | null {
  const effects = device.effects ?? [];

  if (!effects.includes('co2') || !device.effectConfigs?.co2) {
    return null;
  }

  const config = device.effectConfigs.co2;
  const dutyCycle01 = clamp01(Number.isFinite(device.dutyCycle01) ? device.dutyCycle01 : 0);
  const power_W = Number.isFinite(device.powerDraw_W) ? Math.max(0, device.powerDraw_W) : 0;

  if (!Number.isFinite(config.target_ppm) || !Number.isFinite(config.pulse_ppm_per_tick)) {
    return null;
  }

  if (!Number.isFinite(config.safetyMax_ppm)) {
    return null;
  }

  return {
    power_W,
    dutyCycle01,
    target_ppm: config.target_ppm,
    safetyMax_ppm: config.safetyMax_ppm,
    pulse_ppm_per_tick: config.pulse_ppm_per_tick,
    min_ppm: config.min_ppm,
    ambient_ppm: config.ambient_ppm,
    hysteresis_ppm: config.hysteresis_ppm
  } satisfies Co2InjectorInputs;
}

function deriveFiltrationInputs(
  device: ZoneDeviceInstance,
  upstreamAirflow_m3_per_h: number
): FiltrationUnitInputs | null {
  const effects = device.effects ?? [];

  if (!effects.includes('filtration') || !device.effectConfigs?.filtration) {
    return null;
  }

  const config = device.effectConfigs.filtration;
  const condition01 = clamp01(Number.isFinite(device.condition01) ? device.condition01 : 0.9);

  return {
    airflow_m3_per_h: upstreamAirflow_m3_per_h,
    filterType: config.filterType,
    efficiency01: config.efficiency01,
    condition01,
    basePressureDrop_pa: config.basePressureDrop_pa
  } satisfies FiltrationUnitInputs;
}

export function applyDeviceEffects(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const tickHours = resolveTickHours(ctx);
  const runtime = ensureDeviceEffectsRuntime(ctx);
  const maintenanceRuntime = ensureDeviceMaintenanceRuntime(ctx);
  maintenanceRuntime.scheduledTasks.length = 0;
  maintenanceRuntime.completedTasks.length = 0;
  maintenanceRuntime.replacements.length = 0;

  const simHours = Number.isFinite(world.simTimeHours) ? world.simTimeHours : 0;
  const currentTick = Math.trunc(simHours);
  const currentDayIndex = Math.floor(simHours / HOURS_PER_DAY);
  const seed = world.seed;

  let maintenanceCostThisTickCc = 0;
  let structuresChanged = false;

  const nextStructures = world.company.structures.map((structure) => {
    const workshopRoom = structure.rooms.find((room) => room.purpose === 'workshop');
    let roomsChanged = false;

    const nextRooms = structure.rooms.map((room) => {
      let zonesChanged = false;

      const nextZones = room.zones.map((zone) => {
        const { totalCoverage_m2, effectiveness01 } = computeCoverageTotals(zone);
        const height_m = resolveZoneHeight(zone);
        const volume_m3 = Math.max(0, zone.floorArea_m2) * height_m;
        let runningAirflow_m3_per_h = 0;
        let totalAirflowDelivered_m3_per_h = 0;
        let totalAirflowReduction_m3_per_h = 0;
        let devicesChanged = false;

        runtime.zoneCoverageTotals_m2.set(zone.id, totalCoverage_m2);
        runtime.zoneCoverageEffectiveness01.set(zone.id, effectiveness01);
        runtime.zoneAirflowReductions_m3_per_h.set(zone.id, 0);
        runtime.zoneOdorDelta.set(zone.id, 0);
        runtime.zoneParticulateRemoval_pct.set(zone.id, 0);

        emitCoverageWarning(ctx, zone, totalCoverage_m2, Math.max(0, zone.floorArea_m2), effectiveness01);

        const deviceOutcomes: DeviceDegradationOutcome[] = zone.devices.map((device) => {
          const outcome = updateZoneDeviceLifecycle({
            device,
            structure,
            room,
            zone,
            workshopRoom,
            seed,
            tickHours,
            currentTick
          });

          if (outcome.device !== device) {
            devicesChanged = true;
          }

          if (outcome.costAccruedCc) {
            maintenanceCostThisTickCc += outcome.costAccruedCc;
          }

          const energyDevice = outcome.device;
          const duty01 = clamp01(
            Number.isFinite(energyDevice.dutyCycle01) ? energyDevice.dutyCycle01 : 0
          );
          const power_W = Number.isFinite(energyDevice.powerDraw_W)
            ? Math.max(0, energyDevice.powerDraw_W)
            : 0;
          const energy_kWh = (power_W * duty01 * tickHours) / 1_000;

          if (energy_kWh > 0) {
            accumulateEnergyConsumption(ctx, energy_kWh);
          }

          if (outcome.scheduledTask) {
            maintenanceRuntime.scheduledTasks.push(outcome.scheduledTask);
          }

          if (outcome.completedTaskId) {
            maintenanceRuntime.completedTasks.push({ taskId: outcome.completedTaskId });
          }

          if (outcome.replacementJustRecommended) {
            maintenanceRuntime.replacements.push(outcome.replacementJustRecommended);
          }

          return outcome;
        });

        for (const outcome of deviceOutcomes) {
          const device = outcome.device;
          const thermalInputs = deriveThermalInputs(device);
          let thermalDeltaK = 0;

          if (thermalInputs) {
            const thermalStub = createThermalActuatorStub();
            const { deltaT_K } = thermalStub.computeEffect(
              thermalInputs,
              zone.environment,
              zone.airMass_kg,
              tickHours
            );
            thermalDeltaK = deltaT_K;
            accumulateTemperatureDelta(runtime, zone.id, deltaT_K * effectiveness01);
          }

          const humidityInputs = deriveHumidityInputs(device);
          if (humidityInputs) {
            const humidityStub = createHumidityActuatorStub();
            const { deltaRH_pct, water_g } = humidityStub.computeEffect(
              humidityInputs,
              zone.environment,
              zone.airMass_kg,
              tickHours
            );
            accumulateHumidityDelta(runtime, zone.id, deltaRH_pct);

            const latentDeltaK = computeLatentTemperatureDelta(
              water_g,
              zone.airMass_kg,
              effectiveness01,
              thermalInputs,
              thermalDeltaK
            );

            if (latentDeltaK !== 0) {
              accumulateTemperatureDelta(runtime, zone.id, latentDeltaK);
            }
          }

          const lightingInputs = deriveLightingInputs(device);
          if (lightingInputs) {
            const lightingStub = createLightEmitterStub();
            const { ppfd_effective_umol_m2s, dli_mol_m2d_inc } =
              lightingStub.computeEffect(lightingInputs, tickHours);
            accumulatePPFD(runtime, zone.id, ppfd_effective_umol_m2s);
            accumulateDLI(runtime, zone.id, dli_mol_m2d_inc);
          }

          const co2Inputs = deriveCo2Inputs(device);

          if (co2Inputs) {
            const co2Stub = createCo2InjectorStub();
            const { delta_ppm } = co2Stub.computeEffect(co2Inputs, zone.environment, tickHours);
            accumulateCo2Delta(runtime, zone.id, delta_ppm);
          }

          const airflowInputs = deriveAirflowInputs(device);
          let deviceAirflow_m3_per_h = 0;

          if (airflowInputs) {
            const airflowStub = createAirflowActuatorStub();
            const { effective_airflow_m3_per_h } = airflowStub.computeEffect(
              airflowInputs,
              volume_m3,
              tickHours
            );
            deviceAirflow_m3_per_h = effective_airflow_m3_per_h;
          }

          if (deviceAirflow_m3_per_h > 0) {
            runningAirflow_m3_per_h += deviceAirflow_m3_per_h;
            totalAirflowDelivered_m3_per_h += deviceAirflow_m3_per_h;
          }

          const filtrationInputs = deriveFiltrationInputs(device, runningAirflow_m3_per_h);

          if (filtrationInputs) {
            const filtrationStub = createFiltrationStub();
            const { airflow_reduction_m3_per_h, odor_concentration_delta, particulate_removal_pct } =
              filtrationStub.computeEffect(filtrationInputs, tickHours);

            const availableAirflow_m3_per_h = runningAirflow_m3_per_h;
            const reductionApplied_m3_per_h = Math.min(
              airflow_reduction_m3_per_h,
              availableAirflow_m3_per_h
            );

            const currentReduction = runtime.zoneAirflowReductions_m3_per_h.get(zone.id) ?? 0;
            runtime.zoneAirflowReductions_m3_per_h.set(
              zone.id,
              currentReduction + reductionApplied_m3_per_h
            );

            totalAirflowReduction_m3_per_h += reductionApplied_m3_per_h;

            const currentOdor = runtime.zoneOdorDelta.get(zone.id) ?? 0;
            runtime.zoneOdorDelta.set(zone.id, currentOdor + odor_concentration_delta);

            const currentParticulate = runtime.zoneParticulateRemoval_pct.get(zone.id) ?? 0;
            runtime.zoneParticulateRemoval_pct.set(
              zone.id,
              currentParticulate + particulate_removal_pct
            );

            runningAirflow_m3_per_h = Math.max(0, runningAirflow_m3_per_h - reductionApplied_m3_per_h);
          }
        }

        const netAirflow_m3_per_h = Math.max(0, runningAirflow_m3_per_h);
        const netACH = volume_m3 > 0 ? netAirflow_m3_per_h / volume_m3 : 0;

        if (totalAirflowReduction_m3_per_h > 0 || totalAirflowDelivered_m3_per_h > 0) {
          runtime.zoneAirflowReductions_m3_per_h.set(
            zone.id,
            Math.min(totalAirflowDelivered_m3_per_h, totalAirflowReduction_m3_per_h)
          );
        }

        runtime.zoneAirflowTotals_m3_per_h.set(zone.id, netAirflow_m3_per_h);
        runtime.zoneAirChangesPerHour.set(zone.id, netACH);

        emitAirflowWarning(ctx, zone, netAirflow_m3_per_h, netACH, volume_m3);

        const nextDevices = deviceOutcomes.map((outcome) => outcome.device);

        if (devicesChanged) {
          zonesChanged = true;
          return {
            ...zone,
            devices: nextDevices
          } satisfies Zone;
        }

        return zone;
      });

      if (zonesChanged) {
        roomsChanged = true;
        return {
          ...room,
          zones: nextZones
        } satisfies Room;
      }

      return room;
    });

    if (roomsChanged) {
      structuresChanged = true;
      return {
        ...structure,
        rooms: nextRooms
      } satisfies Structure;
    }

    return structure;
  });

  if (maintenanceCostThisTickCc !== 0) {
    updateDeviceMaintenanceAccrual(ctx, currentDayIndex, tickHours, maintenanceCostThisTickCc);
  }

  if (!structuresChanged) {
    return world;
  }

  return {
    ...world,
    company: {
      ...world.company,
      structures: nextStructures
    }
  } satisfies SimulationWorld;
}
