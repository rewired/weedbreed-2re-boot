import { HOURS_PER_TICK } from '../../constants/simConstants.js';
import type { SimulationWorld, Zone } from '../../domain/world.js';
import type { EngineRunContext } from '../Engine.js';
import { applyDeviceHeat } from '../thermo/heat.js';

export interface DeviceEffectsRuntime {
  readonly zoneTemperatureDeltaC: Map<Zone['id'], number>;
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
    zoneTemperatureDeltaC: new Map()
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

export function applyDeviceEffects(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const tickHours = resolveTickHours(ctx);
  const runtime = ensureDeviceEffectsRuntime(ctx);

  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      for (const zone of room.zones) {
        for (const device of zone.devices) {
          const deltaC = applyDeviceHeat(zone, device, tickHours);
          accumulateTemperatureDelta(runtime, zone.id, deltaC);
        }
      }
    }
  }

  return world;
}
