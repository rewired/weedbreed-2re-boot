/* eslint-disable wb-sim/no-ts-import-js-extension */
import type { DeviceInstance, Structure, Zone } from '@wb/engine';
import type { DeviceSummary, StructureWarning } from '../readModels/snapshot.js';
import { roundTo, computeDeviceContribution, computePlantCount, computeCultivationLabourHours, computeIrrigationLabourHours, computeZoneWaterM3PerDay, STRUCTURE_LIGHTING_TARGET, STRUCTURE_HVAC_TARGET, STRUCTURE_AIRFLOW_TARGET, type StructureMetrics } from './readModelShared.js';
import { toVolume } from './readModelShared.js';

export function computeStructureMetrics(structure: Structure): StructureMetrics {
  let zoneAreaTotal = 0;
  let zoneVolumeTotal = 0;
  let lightingCoverageTotal = 0;
  let hvacCoverageTotal = 0;
  let airflowTotal = 0;
  let energyKwhPerDay = 0;
  let waterM3PerDay = 0;
  let labourHoursPerDay = 0;
  let maintenanceCostPerHour = 0;

  for (const room of structure.rooms) {
    for (const zone of room.zones) {
      const plantCount = computePlantCount(zone);
      const zoneArea = zone.floorArea_m2;
      const zoneVolume = toVolume(zone.floorArea_m2, zone.height_m);

      zoneAreaTotal += zoneArea;
      zoneVolumeTotal += zoneVolume;
      labourHoursPerDay += computeCultivationLabourHours(zone, plantCount);
      labourHoursPerDay += computeIrrigationLabourHours(zone, plantCount);
      waterM3PerDay += computeZoneWaterM3PerDay(zone, plantCount);

      for (const device of zone.devices) {
        const contribution = computeDeviceContribution(device, zone.lightSchedule?.onHours);
        lightingCoverageTotal += contribution.lightingCoverage;
        hvacCoverageTotal += contribution.hvacCoverage;
        airflowTotal += contribution.airflow_m3_per_h;
        energyKwhPerDay += contribution.energyKwhPerDay;
        maintenanceCostPerHour += contribution.maintenanceCostPerHour;
      }
    }

    for (const device of room.devices) {
      const contribution = computeDeviceContribution(device);
      lightingCoverageTotal += contribution.lightingCoverage;
      hvacCoverageTotal += contribution.hvacCoverage;
      airflowTotal += contribution.airflow_m3_per_h;
      energyKwhPerDay += contribution.energyKwhPerDay;
      maintenanceCostPerHour += contribution.maintenanceCostPerHour;
    }
  }

  for (const device of structure.devices) {
    const contribution = computeDeviceContribution(device);
    lightingCoverageTotal += contribution.lightingCoverage;
    hvacCoverageTotal += contribution.hvacCoverage;
    airflowTotal += contribution.airflow_m3_per_h;
    energyKwhPerDay += contribution.energyKwhPerDay;
    maintenanceCostPerHour += contribution.maintenanceCostPerHour;
  }

  const lightingCoverage01 = zoneAreaTotal > 0 ? lightingCoverageTotal / zoneAreaTotal : 0;
  const hvacCapacity01 = zoneAreaTotal > 0 ? hvacCoverageTotal / zoneAreaTotal : 0;
  const airflowAch = zoneVolumeTotal > 0 ? airflowTotal / zoneVolumeTotal : 0;

  const warnings: StructureWarning[] = [];

  if (lightingCoverage01 < STRUCTURE_LIGHTING_TARGET) {
    warnings.push({
      id: `${structure.id}:lighting`,
      message: `Lighting coverage at ${(lightingCoverage01 * 100).toFixed(2)}% of demand.`,
      severity: 'warning'
    });
  }

  if (hvacCapacity01 < STRUCTURE_HVAC_TARGET) {
    warnings.push({
      id: `${structure.id}:hvac`,
      message: `HVAC coverage at ${(hvacCapacity01 * 100).toFixed(2)}% of demand.`,
      severity: 'warning'
    });
  }

  if (airflowAch < STRUCTURE_AIRFLOW_TARGET) {
    warnings.push({
      id: `${structure.id}:airflow`,
      message: `Air changes at ${airflowAch.toFixed(2)} ACH (target ${STRUCTURE_AIRFLOW_TARGET}).`,
      severity: 'warning'
    });
  }

  warnings.sort((left, right) => left.id.localeCompare(right.id));

  return {
    lightingCoverage01: roundTo(lightingCoverage01),
    hvacCapacity01: roundTo(hvacCapacity01),
    airflowAch: roundTo(airflowAch),
    energyKwhPerDay: roundTo(energyKwhPerDay),
    waterM3PerDay: roundTo(waterM3PerDay),
    labourHoursPerDay: roundTo(labourHoursPerDay),
    maintenanceCostPerHour: roundTo(maintenanceCostPerHour),
    coverageWarnings: warnings
  } satisfies StructureMetrics;
}

export function computeZoneAirflowAch(zone: Zone): number {
  const volume = toVolume(zone.floorArea_m2, zone.height_m);

  if (!(volume > 0)) {
    return 0;
  }

  const airflowTotal = zone.devices.reduce((total, device) => {
    const airflow = Number.isFinite(device.airflow_m3_per_h) ? (device.airflow_m3_per_h as number) : 0;
    return total + Math.max(airflow, 0);
  }, 0);

  if (!(airflowTotal > 0)) {
    return 0;
  }

  return airflowTotal / volume;
}

export function mapZoneDevice(device: DeviceInstance): DeviceSummary {
  const classSlug = device.slug.includes('.') ? device.slug.split('.')[0] : 'device';

  return {
    id: device.id,
    name: device.name,
    slug: device.slug,
    class: classSlug,
    placementScope: device.placementScope,
    conditionPercent: Math.round(device.condition01 * 100),
    coverageArea_m2: device.coverage_m2,
    airflow_m3_per_hour: device.airflow_m3_per_h,
    powerDraw_kWh_per_hour: device.powerDraw_W / 1000,
    warnings: []
  } satisfies DeviceSummary;
}

export function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}
