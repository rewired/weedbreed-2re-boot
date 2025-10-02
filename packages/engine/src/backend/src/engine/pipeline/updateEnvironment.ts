import {
  AIR_DENSITY_KG_PER_M3,
  CP_AIR_J_PER_KG_K,
  ROOM_DEFAULT_HEIGHT_M
} from '../../constants/simConstants.js';
import type { SimulationWorld, Zone } from '../../domain/world.js';
import type { EngineRunContext } from '../Engine.js';
import {
  clearDeviceEffectsRuntime,
  getDeviceEffectsRuntime,
  resolveTickHours
} from './applyDeviceEffects.js';

const SECONDS_PER_HOUR = 3_600;

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

function resolveAirMassKg(zone: Zone): number {
  if (Number.isFinite(zone.airMass_kg) && zone.airMass_kg > 0) {
    return zone.airMass_kg;
  }

  const height = Number.isFinite(zone.height_m) && zone.height_m > 0 ? zone.height_m : ROOM_DEFAULT_HEIGHT_M;
  const volume_m3 = zone.floorArea_m2 * height;

  if (!Number.isFinite(volume_m3) || volume_m3 <= 0) {
    return 0;
  }

  return volume_m3 * AIR_DENSITY_KG_PER_M3;
}

function computeRemovalDeltaC(zone: Zone, tickHours: number): number {
  const airMassKg = resolveAirMassKg(zone);

  if (airMassKg === 0) {
    return 0;
  }

  const tickSeconds = tickHours * SECONDS_PER_HOUR;
  const removalPower_W = zone.devices.reduce((total, device) => {
    const duty = clamp01(device.dutyCycle01);
    const capacity = Math.max(0, device.sensibleHeatRemovalCapacity_W);

    if (capacity === 0 || duty === 0) {
      return total;
    }

    return total + capacity * duty;
  }, 0);

  if (removalPower_W === 0) {
    return 0;
  }

  const joules = removalPower_W * tickSeconds;

  return joules / (airMassKg * CP_AIR_J_PER_KG_K);
}

function updateZoneTemperature(zone: Zone, netDeltaC: number): Zone {
  if (Math.abs(netDeltaC) < Number.EPSILON) {
    return zone;
  }

  return {
    ...zone,
    environment: {
      ...zone.environment,
      airTemperatureC: zone.environment.airTemperatureC + netDeltaC
    }
  } satisfies Zone;
}

export function updateEnvironment(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const runtime = getDeviceEffectsRuntime(ctx);

  if (!runtime) {
    return world;
  }

  const tickHours = resolveTickHours(ctx);
  const zoneHeatMap = runtime.zoneTemperatureDeltaC;

  let structuresChanged = false;

  const nextStructures = world.company.structures.map((structure) => {
    let roomsChanged = false;

    const nextRooms = structure.rooms.map((room) => {
      let zonesChanged = false;

      const nextZones = room.zones.map((zone) => {
        const additionDeltaC = zoneHeatMap.get(zone.id) ?? 0;
        const removalDeltaC = computeRemovalDeltaC(zone, tickHours);
        const netDeltaC = additionDeltaC - removalDeltaC;

        const nextZone = updateZoneTemperature(zone, netDeltaC);

        if (nextZone !== zone) {
          zonesChanged = true;
        }

        zoneHeatMap.delete(zone.id);

        return nextZone;
      });

      if (zonesChanged) {
        roomsChanged = true;
        return {
          ...room,
          zones: nextZones
        };
      }

      return room;
    });

    if (roomsChanged) {
      structuresChanged = true;
      return {
        ...structure,
        rooms: nextRooms
      };
    }

    return structure;
  });

  clearDeviceEffectsRuntime(ctx);

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
