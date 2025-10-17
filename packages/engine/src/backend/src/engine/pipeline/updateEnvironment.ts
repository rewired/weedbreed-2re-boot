import { FLOAT_TOLERANCE, SAFETY_MAX_CO2_PPM } from '../../constants/simConstants.ts';
import { MIN_AIR_CHANGES_PER_HOUR } from '../../constants/climate.ts';
import type { SimulationWorld, Zone } from '../../domain/world.ts';
import type { EngineRunContext } from '../Engine.ts';
import { clearDeviceEffectsRuntime, getDeviceEffectsRuntime } from './applyDeviceEffects.ts';
import {
  TELEMETRY_ZONE_SNAPSHOT_V1,
  type TelemetryZoneSnapshotPayload,
  type TelemetryZoneSnapshotWarning,
} from '../../telemetry/topics.ts';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toPercent(value: number): number {
  if (!isFiniteNumber(value)) {
    return 0;
  }

  return value * 100;
}

function createZoneWarnings(
  zone: Zone,
  ach: number,
  coverageEffectiveness01: number | undefined,
): TelemetryZoneSnapshotWarning[] {
  const warnings: TelemetryZoneSnapshotWarning[] = [];

  if (isFiniteNumber(ach) && ach + FLOAT_TOLERANCE < MIN_AIR_CHANGES_PER_HOUR) {
    warnings.push({
      code: 'zone.airflow.low',
      severity: 'warning',
      message: `Zone "${zone.name}" airflow below target (${ach.toFixed(2)} ACH < ${MIN_AIR_CHANGES_PER_HOUR.toFixed(2)} ACH).`,
    });
  }

  if (isFiniteNumber(coverageEffectiveness01) && coverageEffectiveness01 + FLOAT_TOLERANCE < 1) {
    warnings.push({
      code: 'zone.coverage.low',
      severity: 'warning',
      message: `Zone "${zone.name}" device coverage at ${(coverageEffectiveness01 * 100).toFixed(1)}% of demand.`,
    });
  }

  return warnings;
}

function createZoneSnapshot(
  zone: Zone,
  simTime: number,
  ach: number,
  coverageEffectiveness01: number | undefined,
): TelemetryZoneSnapshotPayload {
  const environment = zone.environment;
  const warnings = createZoneWarnings(zone, ach, coverageEffectiveness01);

  return {
    zoneId: zone.id,
    simTime,
    ppfd: isFiniteNumber(zone.ppfd_umol_m2s) ? zone.ppfd_umol_m2s : 0,
    dli_incremental: isFiniteNumber(zone.dli_mol_m2d_inc) ? zone.dli_mol_m2d_inc : 0,
    temp_c: isFiniteNumber(environment.airTemperatureC) ? environment.airTemperatureC : 0,
    rh: toPercent(environment.relativeHumidity01),
    co2_ppm: isFiniteNumber(environment.co2_ppm) ? environment.co2_ppm : 0,
    ach: isFiniteNumber(ach) ? ach : 0,
    warnings,
  } satisfies TelemetryZoneSnapshotPayload;
}

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

  if (value >= 1) {
    return 1;
  }

  return value;
}

function updateZoneHumidity(zone: Zone, deltaRH01: number): Zone {
  if (Math.abs(deltaRH01) < FLOAT_TOLERANCE) {
    return zone;
  }

  const currentRaw = zone.environment.relativeHumidity01;
  const current = Number.isFinite(currentRaw) ? currentRaw : 0;
  const next = clampHumidity(current + deltaRH01);

  if (Math.abs(next - current) < FLOAT_TOLERANCE) {
    return zone;
  }

  return {
    ...zone,
    environment: {
      ...zone.environment,
      relativeHumidity01: next
    }
  } satisfies Zone;
}

function clampCo2(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= SAFETY_MAX_CO2_PPM) {
    return SAFETY_MAX_CO2_PPM;
  }

  return value;
}

function updateZoneCo2(zone: Zone, delta_ppm: number): Zone {
  if (Math.abs(delta_ppm) < FLOAT_TOLERANCE) {
    return zone;
  }

  const currentRaw = zone.environment.co2_ppm;
  const current = Number.isFinite(currentRaw) ? currentRaw : 0;
  const next = clampCo2(current + delta_ppm);

  if (Math.abs(next - current) < FLOAT_TOLERANCE) {
    return zone;
  }

  return {
    ...zone,
    environment: {
      ...zone.environment,
      co2_ppm: next
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
  const zoneHumidityMap = runtime.zoneHumidityDelta01;
  const zonePPFDMap = runtime.zonePPFD_umol_m2s;
  const zoneDLIMap = runtime.zoneDLI_mol_m2d_inc;
  const zoneCo2Map = runtime.zoneCo2Delta_ppm;
  const zoneSnapshots: TelemetryZoneSnapshotPayload[] = [];

  const nextStructures = world.company.structures.map((structure) => {
    const nextRooms = structure.rooms.map((room) => {
      const nextZones = room.zones.map((zone) => {
        const additionDeltaC = zoneHeatMap.get(zone.id) ?? 0;
        const netDeltaC = additionDeltaC;

        let nextZone = updateZoneTemperature(zone, netDeltaC);
        zoneHeatMap.delete(zone.id);

        const deltaRH01 = zoneHumidityMap.get(zone.id) ?? 0;
        nextZone = updateZoneHumidity(nextZone, deltaRH01);
        zoneHumidityMap.delete(zone.id);

        const deltaCo2_ppm = zoneCo2Map.get(zone.id) ?? 0;
        nextZone = updateZoneCo2(nextZone, deltaCo2_ppm);
        zoneCo2Map.delete(zone.id);

        const ppfd = zonePPFDMap.get(zone.id) ?? 0;
        const dli_inc = zoneDLIMap.get(zone.id) ?? 0;
        nextZone = updateZoneLighting(nextZone, ppfd, dli_inc);
        zonePPFDMap.delete(zone.id);
        zoneDLIMap.delete(zone.id);

        const finalZone = nextZone !== zone ? nextZone : zone;

        const ach = runtime.zoneAirChangesPerHour.get(zone.id) ?? 0;
        const coverageEffectiveness = runtime.zoneCoverageEffectiveness01.get(zone.id);
        zoneSnapshots.push(createZoneSnapshot(finalZone, world.simTimeHours, ach, coverageEffectiveness));

        return finalZone;
      });

      const zonesChanged = nextZones.some((candidate, index) => candidate !== room.zones[index]);

      return zonesChanged
        ? {
            ...room,
            zones: nextZones
          }
        : room;
    });

    const roomsChanged = nextRooms.some(
      (candidate, index) => candidate !== structure.rooms[index]
    );

    if (roomsChanged) {
      return {
        ...structure,
        rooms: nextRooms
      };
    }

    return structure;
  });

  clearDeviceEffectsRuntime(ctx);

  if (zoneSnapshots.length > 0) {
    for (const snapshot of zoneSnapshots) {
      ctx.telemetry?.emit(TELEMETRY_ZONE_SNAPSHOT_V1, { ...snapshot, warnings: [...snapshot.warnings] });
    }
  }

  const structuresChanged = nextStructures.some(
    (candidate, index) => candidate !== world.company.structures[index]
  );

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
