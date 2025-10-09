import { HOURS_PER_DAY } from '../../constants/simConstants.ts';
import type { SimulationWorld, Zone, Room, Structure } from '../../domain/world.ts';
import type { EngineRunContext } from '../Engine.ts';
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
import {
  finalizeZoneAggregation,
  initializeZoneAggregation
} from './aggregate/zoneEffects.ts';
import { applyThermalEffect } from './effects/thermal.ts';
import { applyHumidityEffect } from './effects/humidity.ts';
import { applyLightingEffect } from './effects/lighting.ts';
import { applyCo2Effect } from './effects/co2.ts';
import { applyAirflowAndFiltrationEffect } from './effects/airflow.ts';

export interface DeviceEffectsRuntime {
  readonly zoneTemperatureDeltaC: Map<Zone['id'], number>;
  readonly zoneHumidityDelta01: Map<Zone['id'], number>;
  readonly zonePPFD_umol_m2s: Map<Zone['id'], number>;
  readonly zoneDLI_mol_m2d_inc: Map<Zone['id'], number>;
  readonly zoneCo2Delta_ppm: Map<Zone['id'], number>;
  readonly zoneCoverageTotals_m2: Map<Zone['id'], number>;
  readonly zoneAirflowTotals_m3_per_h: Map<Zone['id'], number>;
  readonly zoneCoverageEffectiveness01: Map<Zone['id'], number>;
  readonly zoneAirChangesPerHour: Map<Zone['id'], number>;
  readonly zoneAirflowReductions_m3_per_h: Map<Zone['id'], number>;
  readonly zoneOdorDelta: Map<Zone['id'], number>;
  readonly zoneParticulateRemoval01: Map<Zone['id'], number>;
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
    zoneHumidityDelta01: new Map(),
    zonePPFD_umol_m2s: new Map(),
    zoneDLI_mol_m2d_inc: new Map(),
    zoneCo2Delta_ppm: new Map(),
    zoneCoverageTotals_m2: new Map(),
    zoneAirflowTotals_m3_per_h: new Map(),
    zoneCoverageEffectiveness01: new Map(),
    zoneAirChangesPerHour: new Map(),
    zoneAirflowReductions_m3_per_h: new Map(),
    zoneOdorDelta: new Map(),
    zoneParticulateRemoval01: new Map()
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
        const aggregation = initializeZoneAggregation(zone, ctx, runtime);
        let devicesChanged = false;

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
          const { thermalInputs, thermalDeltaK } = applyThermalEffect(
            device,
            zone,
            runtime,
            tickHours,
            aggregation.effectiveness01
          );

          applyHumidityEffect(
            device,
            zone,
            runtime,
            tickHours,
            aggregation.effectiveness01,
            thermalInputs,
            thermalDeltaK
          );

          applyLightingEffect(device, zone, runtime, tickHours);
          applyCo2Effect(device, zone, runtime, tickHours);
          applyAirflowAndFiltrationEffect(device, aggregation, tickHours);
        }

        finalizeZoneAggregation(aggregation);

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
