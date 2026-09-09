/* eslint-disable wb-sim/no-ts-import-js-extension */
import type { ParsedCompanyWorld, Room, SimulationWorld, Structure, WorkforceState, Zone } from '@wb/engine';
import { computeVpd_kPa } from '@/backend/src/physiology/vpd.js';
import type { RoomReadModel, StructureReadModel, StructureWarning, ZoneReadModel } from '../readModels/snapshot.js';
import { createZoneAirflowWarning, mapZoneTasks, roundTo, computePlantCount, toVolume, ZONE_ACH_TARGET, type StructureMetrics, type ZoneDeviceWarning } from './readModelShared.js';
import { average, computeZoneAirflowAch, mapZoneDevice } from './readModelMetrics.js';
import { mapZoneReadiness } from './readModelReadiness.js';
import {
  mapHarvestEligibility,
  mapPlants,
  mapSowEligibility,
  mapStrainChoices,
} from './readModelPlants.js';

export function mapZone(zone: Zone, workforce: WorkforceState, world: SimulationWorld): ZoneReadModel {
  const plants = zone.plants.filter((plant) => plant.status !== 'harvested');
  const plantCount = plants.length;
  const maxPlants = computePlantCount(zone);
  const healthAvg = average(plants.map((plant) => plant.health01)) * 100;
  const qualityAvg = average(plants.map((plant) => plant.quality01 ?? 0)) * 100;
  const stressPercent = 0;
  const biomassKg = plants.reduce((total, plant) => total + plant.biomass_g, 0) / 1000;

  const primaryPlant = plants[0];
  const strainId = primaryPlant?.strainId ?? '';

  const temperatureC = zone.environment.airTemperatureC;
  const humidityFraction = zone.environment.relativeHumidity01;
  const vpd = computeVpd_kPa(temperatureC, humidityFraction);
  const achMeasured = computeZoneAirflowAch(zone);
  const airflowWarning = createZoneAirflowWarning(zone, achMeasured);
  const coverageWarnings: ZoneDeviceWarning[] = airflowWarning ? [airflowWarning] : [];
  const climateStatus = coverageWarnings.length > 0 ? 'warn' : 'ok';
  const readiness = mapZoneReadiness(zone);

  return {
    id: zone.id,
    name: zone.name,
    area_m2: zone.floorArea_m2,
    volume_m3: toVolume(zone.floorArea_m2, zone.height_m),
    cultivationMethodId: zone.cultivationMethodId,
    irrigationMethodId: zone.irrigationMethodId,
    strainId,
    maxPlants,
    currentPlantCount: plantCount,
    kpis: {
      healthPercent: Math.round(healthAvg),
      qualityPercent: Math.round(qualityAvg),
      stressPercent: Math.round(stressPercent),
      biomass_kg: Number.parseFloat(biomassKg.toFixed(2)),
      growthRatePercent: 0
    },
    pestStatus: {
      activeIssues: 0,
      dueInspections: 0,
      upcomingTreatments: 0,
      nextInspectionTick: 0,
      lastInspectionTick: 0
    },
    devices: zone.devices.map(mapZoneDevice),
    coverageWarnings,
    climateSnapshot: {
      temperature_C: roundTo(temperatureC, 2),
      relativeHumidity_percent: Math.round(humidityFraction * 100),
      co2_ppm: zone.environment.co2_ppm,
      vpd_kPa: roundTo(vpd, 6),
      ach_measured: roundTo(achMeasured, 6),
      ach_target: ZONE_ACH_TARGET,
      status: climateStatus
    },
    timeline: [],
    tasks: mapZoneTasks(zone, workforce),
    readiness,
    plants: mapPlants(world, zone),
    harvestEligibility: mapHarvestEligibility(zone),
    sowEligibility: mapSowEligibility(zone, readiness),
    strainChoices: mapStrainChoices(world, zone)
  } satisfies ZoneReadModel;
}

export function mapRoom(
  structureId: Structure['id'],
  room: Room,
  workforce: WorkforceState,
  world: SimulationWorld
): RoomReadModel {
  const zones = room.zones.map((zone) => mapZone(zone, workforce, world));
  const zoneAreaTotal = zones.reduce((total, zone) => total + zone.area_m2, 0);
  const zoneVolumeTotal = zones.reduce((total, zone) => total + zone.volume_m3, 0);
  const areaFree = Math.max(room.floorArea_m2 - zoneAreaTotal, 0);
  const volume = toVolume(room.floorArea_m2, room.height_m);
  const volumeFree = Math.max(volume - zoneVolumeTotal, 0);

  const zoneClimates = zones.map((zone) => zone.climateSnapshot);
  const temperature = average(zoneClimates.map((climate) => climate.temperature_C));
  const humidity = average(zoneClimates.map((climate) => climate.relativeHumidity_percent));
  const co2 = average(zoneClimates.map((climate) => climate.co2_ppm));
  const achValues = zoneClimates.map((climate) => climate.ach_measured);
  const achAverage = average(achValues);

  const climateWarningMap = new Map<string, StructureWarning>();

  for (const zone of zones) {
    for (const warning of zone.coverageWarnings) {
      climateWarningMap.set(warning.id, {
        id: warning.id,
        message: warning.message,
        severity: warning.severity
      });
    }
  }

  const climateWarnings = Array.from(climateWarningMap.values()).sort((left, right) =>
    left.id.localeCompare(right.id)
  );

  return {
    id: room.id,
    structureId,
    name: room.name,
    purpose: room.purpose,
    area_m2: room.floorArea_m2,
    volume_m3: volume,
    capacity: {
      areaUsed_m2: Number.parseFloat(zoneAreaTotal.toFixed(2)),
      areaFree_m2: Number.parseFloat(areaFree.toFixed(2)),
      volumeUsed_m3: Number.parseFloat(zoneVolumeTotal.toFixed(2)),
      volumeFree_m3: Number.parseFloat(volumeFree.toFixed(2))
    },
    coverage: {
      achCurrent: roundTo(achAverage, 6),
      achTarget: ZONE_ACH_TARGET,
      climateWarnings
    },
    climateSnapshot: {
      temperature_C: Number.isFinite(temperature) ? Number.parseFloat(temperature.toFixed(2)) : 0,
      relativeHumidity_percent: Number.isFinite(humidity) ? Math.round(humidity) : 0,
      co2_ppm: Number.isFinite(co2) ? Math.round(co2) : 0,
      ach: roundTo(achAverage, 6),
      notes: 'Aggregated from zone climate snapshots.'
    },
    devices: room.devices.map(mapZoneDevice),
    zones,
    timeline: []
  } satisfies RoomReadModel;
}

export function buildStructureLocation(structure: Structure, companyWorld: ParsedCompanyWorld): string {
  const companyLocation = companyWorld.location;
  return `${companyLocation.cityName}, ${companyLocation.countryName}`;
}

export function mapStructure(
  structure: Structure,
  companyWorld: ParsedCompanyWorld,
  workforce: WorkforceState,
  metrics: StructureMetrics,
  world: SimulationWorld
): StructureReadModel {
  const rooms = structure.rooms.map((room) => mapRoom(structure.id, room, workforce, world));
  const structureZoneArea = rooms.reduce(
    (total, room) => total + room.capacity.areaUsed_m2,
    0
  );
  const structureZoneVolume = rooms.reduce(
    (total, room) => total + room.capacity.volumeUsed_m3,
    0
  );
  const areaFree = Math.max(structure.floorArea_m2 - structureZoneArea, 0);
  const volume = toVolume(structure.floorArea_m2, structure.height_m);
  const volumeFree = Math.max(volume - structureZoneVolume, 0);

  const employeesByStructure = workforce.employees.filter(
    (employee) => employee.assignedStructureId === structure.id
  );

  return {
    id: structure.id,
    name: structure.name,
    location: buildStructureLocation(structure, companyWorld),
    area_m2: structure.floorArea_m2,
    volume_m3: volume,
    capacity: {
      areaUsed_m2: Number.parseFloat(structureZoneArea.toFixed(2)),
      areaFree_m2: Number.parseFloat(areaFree.toFixed(2)),
      volumeUsed_m3: Number.parseFloat(structureZoneVolume.toFixed(2)),
      volumeFree_m3: Number.parseFloat(volumeFree.toFixed(2))
    },
    coverage: {
      lightingCoverage01: metrics.lightingCoverage01,
      hvacCapacity01: metrics.hvacCapacity01,
      airflowAch: metrics.airflowAch,
      warnings: metrics.coverageWarnings
    },
    kpis: {
      energyKwhPerDay: metrics.energyKwhPerDay,
      waterM3PerDay: metrics.waterM3PerDay,
      labourHoursPerDay: metrics.labourHoursPerDay,
      maintenanceCostPerHour: metrics.maintenanceCostPerHour
    },
    devices: structure.devices.map(mapZoneDevice),
    rooms,
    workforce: {
      activeAssignments: employeesByStructure.map((employee) => ({
        employeeId: employee.id,
        employeeName: employee.name,
        role: 'structure',
        assignedScope: 'structure',
        targetId: structure.id
      })),
      openTasks: workforce.taskQueue.length,
      notes: employeesByStructure.length > 0 ? 'Active workforce assigned.' : 'No workforce assignments.'
    },
    timeline: []
  } satisfies StructureReadModel;
}
