import { FLOAT_TOLERANCE } from '../../constants/simConstants.js';
import type { SimulationWorld, Zone } from '../../domain/world.js';
import type { EngineRunContext } from '../Engine.js';
import { clearDeviceEffectsRuntime, getDeviceEffectsRuntime } from './applyDeviceEffects.js';

function updateZoneTemperature(zone: Zone, netDeltaC: number): Zone {
  if (Math.abs(netDeltaC) < FLOAT_TOLERANCE) {
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

function clampHumidity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 100) {
    return 100;
  }

  return value;
}

function updateZoneHumidity(zone: Zone, deltaRH_pct: number): Zone {
  if (Math.abs(deltaRH_pct) < FLOAT_TOLERANCE) {
    return zone;
  }

  const currentRaw = zone.environment.relativeHumidity_pct;
  const current = Number.isFinite(currentRaw) ? currentRaw : 0;
  const next = clampHumidity(current + deltaRH_pct);

  if (Math.abs(next - current) < FLOAT_TOLERANCE) {
    return zone;
  }

  return {
    ...zone,
    environment: {
      ...zone.environment,
      relativeHumidity_pct: next
    }
  } satisfies Zone;
}

function updateZoneLighting(zone: Zone, ppfd: number, dli_inc: number): Zone {
  const nextPPFD = Number.isFinite(ppfd) && ppfd > 0 ? ppfd : 0;
  const nextDLI = Number.isFinite(dli_inc) && dli_inc > 0 ? dli_inc : 0;

  if (nextPPFD <= 0 && nextDLI <= 0) {
    return zone;
  }

  let changed = false;
  let draft: Zone = zone;

  if (Math.abs(nextPPFD - zone.ppfd_umol_m2s) > FLOAT_TOLERANCE) {
    draft = {
      ...draft,
      ppfd_umol_m2s: nextPPFD
    } satisfies Zone;
    changed = true;
  }

  if (Math.abs(nextDLI - draft.dli_mol_m2d_inc) > FLOAT_TOLERANCE) {
    draft = {
      ...draft,
      dli_mol_m2d_inc: nextDLI
    } satisfies Zone;
    changed = true;
  }

  return changed ? draft : zone;
}

export function updateEnvironment(world: SimulationWorld, ctx: EngineRunContext): SimulationWorld {
  const runtime = getDeviceEffectsRuntime(ctx);

  if (!runtime) {
    return world;
  }

  const zoneHeatMap = runtime.zoneTemperatureDeltaC;
  const zoneHumidityMap = runtime.zoneHumidityDeltaPct;
  const zonePPFDMap = runtime.zonePPFD_umol_m2s;
  const zoneDLIMap = runtime.zoneDLI_mol_m2d_inc;

  let structuresChanged = false;

  const nextStructures = world.company.structures.map((structure) => {
    let roomsChanged = false;

    const nextRooms = structure.rooms.map((room) => {
      let zonesChanged = false;

      const nextZones = room.zones.map((zone) => {
        const additionDeltaC = zoneHeatMap.get(zone.id) ?? 0;
        const netDeltaC = additionDeltaC;

        let nextZone = updateZoneTemperature(zone, netDeltaC);
        zoneHeatMap.delete(zone.id);

        const deltaRH_pct = zoneHumidityMap.get(zone.id) ?? 0;
        nextZone = updateZoneHumidity(nextZone, deltaRH_pct);
        zoneHumidityMap.delete(zone.id);

        const ppfd = zonePPFDMap.get(zone.id) ?? 0;
        const dli_inc = zoneDLIMap.get(zone.id) ?? 0;
        nextZone = updateZoneLighting(nextZone, ppfd, dli_inc);
        zonePPFDMap.delete(zone.id);
        zoneDLIMap.delete(zone.id);

        if (nextZone !== zone) {
          zonesChanged = true;
        }

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
