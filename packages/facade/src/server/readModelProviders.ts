/* eslint-disable wb-sim/no-ts-import-js-extension */

import type {
  EngineBootstrapConfig,
  ParsedCompanyWorld,
  SimulationWorld,
  Structure,
  Room,
  Zone,
  DeviceInstance,
  WorkforceWarning,
  WorkforceState
} from '@wb/engine';
import { HOURS_PER_DAY } from '@engine/constants/time.js';
import type { ReadModelProviders } from './http.js';
import {
  parseCultivationMethodBlueprint
} from '@/backend/src/domain/blueprints/cultivationMethodBlueprint.ts';
import { parseContainerBlueprint } from '@/backend/src/domain/blueprints/containerBlueprint.ts';
import { parseSubstrateBlueprint } from '@/backend/src/domain/blueprints/substrateBlueprint.ts';
import { parseIrrigationBlueprint } from '@/backend/src/domain/blueprints/irrigationBlueprint.ts';
import { estimateIrrigationCharge } from '@/backend/src/domain/irrigation/waterUsage.ts';
import { computeVpd_kPa } from '@/backend/src/physiology/vpd.ts';
import seaOfGreenJson from '../../../../data/blueprints/cultivation-method/sea-of-green.json' with { type: 'json' };
import screenOfGreenJson from '../../../../data/blueprints/cultivation-method/screen-of-green.json' with { type: 'json' };
import pot11Json from '../../../../data/blueprints/container/pot-11l.json' with { type: 'json' };
import pot25Json from '../../../../data/blueprints/container/pot-25l.json' with { type: 'json' };
import cocoCoirJson from '../../../../data/blueprints/substrate/coco-coir.json' with { type: 'json' };
import soilMultiJson from '../../../../data/blueprints/substrate/soil-multi-cycle.json' with { type: 'json' };
import soilSingleJson from '../../../../data/blueprints/substrate/soil-single-cycle.json' with { type: 'json' };
import dripJson from '../../../../data/blueprints/irrigation/drip-inline-fertigation-basic.json' with { type: 'json' };
import manualIrrigationJson from '../../../../data/blueprints/irrigation/manual-watering-can.json' with { type: 'json' };
import devicePricesJson from '../../../../data/prices/devicePrices.json' with { type: 'json' };
import consumablePricesJson from '../../../../data/prices/consumablePrices.json' with { type: 'json' };
import strainPricesJson from '../../../../data/prices/strainPrices.json' with { type: 'json' };
import {
  COMPANY_TREE_SCHEMA_VERSION,
  STRUCTURE_TARIFFS_SCHEMA_VERSION,
  WORKFORCE_VIEW_SCHEMA_VERSION,
  type CompanyTreeReadModel,
  type StructureTariffsReadModel,
  type WorkforceViewReadModel
} from '../readModels/api/schemas.js';
import {
  composeReadModelSnapshot,
  type ReadModelSnapshot,
  type StructureReadModel,
  type RoomReadModel,
  type ZoneReadModel,
  type DeviceSummary,
  type EconomyReadModel,
  type SimulationReadModel,
  type HrReadModel,
  type PriceBookCatalog,
  type CompatibilityMaps,
  type StructureWarning
} from '../readModels/snapshot.js';
import { structureTariffs as createStructureTariffsReadModel } from '@/backend/src/readmodels/economy/structureTariffs.ts';
import { parseDevicePriceMap } from '@/backend/src/domain/pricing/devicePriceMap.ts';

interface EngineContext {
  readonly world: SimulationWorld;
  readonly companyWorld: ParsedCompanyWorld;
  readonly config: EngineBootstrapConfig;
}

const CULTIVATION_BLUEPRINTS = [
  parseCultivationMethodBlueprint(seaOfGreenJson),
  parseCultivationMethodBlueprint(screenOfGreenJson)
] as const;
const CULTIVATION_BY_ID = new Map(CULTIVATION_BLUEPRINTS.map((blueprint) => [blueprint.id, blueprint]));

const CONTAINER_BLUEPRINTS = [
  parseContainerBlueprint(pot11Json),
  parseContainerBlueprint(pot25Json)
] as const;
const CONTAINER_BY_ID = new Map(CONTAINER_BLUEPRINTS.map((blueprint) => [blueprint.id, blueprint]));

const SUBSTRATE_BLUEPRINTS = [
  parseSubstrateBlueprint(cocoCoirJson),
  parseSubstrateBlueprint(soilMultiJson),
  parseSubstrateBlueprint(soilSingleJson)
] as const;
const SUBSTRATE_BY_ID = new Map(SUBSTRATE_BLUEPRINTS.map((blueprint) => [blueprint.id, blueprint]));
const SUBSTRATE_SLUG_SET = new Set(SUBSTRATE_BLUEPRINTS.map((blueprint) => blueprint.slug));

const IRRIGATION_BLUEPRINTS = [
  parseIrrigationBlueprint(dripJson, { knownSubstrateSlugs: SUBSTRATE_SLUG_SET }),
  parseIrrigationBlueprint(manualIrrigationJson, { knownSubstrateSlugs: SUBSTRATE_SLUG_SET })
] as const;
const IRRIGATION_BY_ID = new Map(IRRIGATION_BLUEPRINTS.map((blueprint) => [blueprint.id, blueprint]));

const STRUCTURE_LIGHTING_TARGET = 1;
const STRUCTURE_HVAC_TARGET = 1;
const STRUCTURE_AIRFLOW_TARGET = 6;
const ZONE_ACH_TARGET = STRUCTURE_AIRFLOW_TARGET;

const DEVICE_PRICE_ENTRIES = parseDevicePriceMap(devicePricesJson).devicePrices;
const CONSUMABLE_CONTAINER_PRICES = consumablePricesJson?.containers ?? {};
const CONSUMABLE_SUBSTRATE_PRICES = consumablePricesJson?.substrates ?? {};
const STRAIN_PRICE_MAP = strainPricesJson?.strainPrices ?? {};

function clampFraction(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function roundTo(value: number, digits = 6): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number.parseFloat(value.toFixed(digits));
}

function sanitizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

interface StructureMetrics {
  readonly lightingCoverage01: number;
  readonly hvacCapacity01: number;
  readonly airflowAch: number;
  readonly energyKwhPerDay: number;
  readonly waterM3PerDay: number;
  readonly labourHoursPerDay: number;
  readonly maintenanceCostPerHour: number;
  readonly coverageWarnings: readonly StructureWarning[];
}

type ZoneTaskEntry = ZoneReadModel['tasks'][number];
type ZoneDeviceWarning = ZoneReadModel['coverageWarnings'][number];
type WorkforceTaskInstance = WorkforceState['taskQueue'][number];
type WorkforceEmployee = WorkforceState['employees'][number];

const ZONE_TASK_TYPE_MAP: Record<string, ZoneTaskEntry['type']> = {
  repair_device: 'maintenance',
  maintain_device: 'maintenance',
  refill_supplies_water: 'maintenance',
  refill_supplies_nutrients: 'maintenance',
  clean_zone: 'maintenance',
  overhaul_zone_substrate: 'maintenance',
  reset_light_cycle: 'maintenance',
  adjust_light_cycle: 'maintenance',
  execute_planting_plan: 'training',
  harvest_plants: 'harvest',
  apply_treatment: 'treatment'
};

const WORKFORCE_STATUS_MAP: Record<WorkforceTaskInstance['status'], ZoneTaskEntry['status']> = {
  queued: 'queued',
  'in-progress': 'in-progress',
  completed: 'done',
  cancelled: 'done'
};

function resolveZoneTaskType(taskCode: string): ZoneTaskEntry['type'] {
  return ZONE_TASK_TYPE_MAP[taskCode] ?? 'maintenance';
}

function resolveZoneTaskStatus(status: WorkforceTaskInstance['status']): ZoneTaskEntry['status'] {
  return WORKFORCE_STATUS_MAP[status] ?? 'queued';
}

function extractTaskZoneId(task: WorkforceTaskInstance): string | null {
  const context = task.context;

  if (!context || typeof context !== 'object') {
    return null;
  }

  const directZoneId =
    (context as { zoneId?: unknown }).zoneId ??
    (context as { targetZoneId?: unknown }).targetZoneId ??
    (context as { zone?: { id?: unknown } }).zone?.id;

  if (typeof directZoneId === 'string') {
    return directZoneId;
  }

  if ((context as { targetScope?: unknown }).targetScope === 'zone') {
    const targetId = (context as { targetId?: unknown }).targetId;
    if (typeof targetId === 'string') {
      return targetId;
    }
  }

  return null;
}

function mapZoneTasks(zone: Zone, workforce: WorkforceState): ZoneTaskEntry[] {
  const queue = Array.isArray(workforce.taskQueue) ? (workforce.taskQueue as WorkforceTaskInstance[]) : [];

  const entries: ZoneTaskEntry[] = [];

  for (const task of queue) {
    const zoneId = extractTaskZoneId(task);
    if (zoneId !== zone.id) {
      continue;
    }

    const scheduledTick = Number.isFinite(task.dueTick) ? (task.dueTick as number) : task.createdAtTick;

    entries.push({
      id: task.id,
      type: resolveZoneTaskType(task.taskCode),
      status: resolveZoneTaskStatus(task.status),
      assigneeId: task.assignedEmployeeId ?? null,
      scheduledTick,
      targetZoneId: zone.id
    });
  }

  return entries.sort((left, right) => left.scheduledTick - right.scheduledTick);
}

function createZoneAirflowWarning(zone: Zone, ach: number): ZoneDeviceWarning | null {
  if (!(ach < ZONE_ACH_TARGET)) {
    return null;
  }

  return {
    id: `${zone.id}:airflow`,
    message: `Air changes at ${ach.toFixed(2)} ACH (target ${ZONE_ACH_TARGET}).`,
    severity: 'warning'
  } satisfies ZoneDeviceWarning;
}

interface DeviceContribution {
  readonly lightingCoverage: number;
  readonly hvacCoverage: number;
  readonly airflow_m3_per_h: number;
  readonly energyKwhPerDay: number;
  readonly maintenanceCostPerHour: number;
}

function resolveCultivationMethod(id: string) {
  return CULTIVATION_BY_ID.get(id);
}

function resolveContainer(id: string) {
  return CONTAINER_BY_ID.get(id);
}

function resolveSubstrate(id: string) {
  return SUBSTRATE_BY_ID.get(id);
}

function resolveIrrigation(id: string) {
  return IRRIGATION_BY_ID.get(id);
}

function computePlantCount(zone: Zone): number {
  const method = resolveCultivationMethod(zone.cultivationMethodId);
  const areaPerPlant = method?.areaPerPlant_m2;

  if (!Number.isFinite(areaPerPlant) || (areaPerPlant ?? 0) <= 0) {
    return Math.max(1, Math.round(zone.floorArea_m2));
  }

  return Math.max(1, Math.floor(zone.floorArea_m2 / (areaPerPlant ?? 1)));
}

function computeCultivationLabourHours(zone: Zone, plantCount: number): number {
  const method = resolveCultivationMethod(zone.cultivationMethodId);
  const hoursPerPlantPerWeek = method?.laborProfile?.hoursPerPlantPerWeek;

  if (!Number.isFinite(hoursPerPlantPerWeek) || (hoursPerPlantPerWeek ?? 0) <= 0) {
    return 0;
  }

  return (hoursPerPlantPerWeek ?? 0) * plantCount / 7;
}

function computeIrrigationLabourHours(zone: Zone, plantCount: number): number {
  const blueprint = resolveIrrigation(zone.irrigationMethodId) as
    | { labor?: { basis?: string; minutes?: number } }
    | undefined;
  const labour = blueprint?.labor;
  const minutes = labour?.minutes;

  if (!Number.isFinite(minutes) || (minutes ?? 0) <= 0) {
    return 0;
  }

  if (labour?.basis === 'perPlant') {
    return ((minutes ?? 0) * plantCount) / 60;
  }

  return (minutes ?? 0) / 60;
}

function computeZoneWaterM3PerDay(zone: Zone, plantCount: number): number {
  const container = resolveContainer(zone.containerId);
  const substrate = resolveSubstrate(zone.substrateId);
  const irrigation = resolveIrrigation(zone.irrigationMethodId) as
    | { runoff?: { defaultFraction?: number } }
    | undefined;

  if (!container || !substrate) {
    return 0;
  }

  const containerVolume = container.volumeInLiters;

  if (!Number.isFinite(containerVolume) || containerVolume <= 0) {
    return 0;
  }

  const runoffFraction = irrigation?.runoff?.defaultFraction;
  const moistureTarget = clampFraction(zone.moisture01 ?? 0.5);

  const estimate = estimateIrrigationCharge({
    substrate: { densityFactor_L_per_kg: substrate.densityFactor_L_per_kg },
    containerVolume_L: containerVolume,
    plantCount,
    targetMoistureFraction01: moistureTarget,
    runoffFraction01:
      typeof runoffFraction === 'number' && runoffFraction > 0 && runoffFraction < 1
        ? runoffFraction
        : undefined
  });

  return estimate.deliveredVolume_L / 1000;
}

function computeDeviceContribution(device: DeviceInstance, scheduleHours?: number): DeviceContribution {
  const effects = Array.isArray(device.effects) ? device.effects : [];
  const isLighting = effects.includes('lighting');
  const isHvac = !isLighting && effects.some((effect) => effect === 'thermal' || effect === 'humidity' || effect === 'airflow');
  const coverage = Number.isFinite(device.coverage_m2) && device.coverage_m2 > 0 ? device.coverage_m2 : 0;
  const airflow = Number.isFinite(device.airflow_m3_per_h) && device.airflow_m3_per_h > 0 ? device.airflow_m3_per_h : 0;
  const duty = clampFraction(device.dutyCycle01 ?? 1);
  const powerDraw_W = Number.isFinite(device.powerDraw_W) && device.powerDraw_W > 0 ? device.powerDraw_W : 0;
  const hours = isLighting && Number.isFinite(scheduleHours)
    ? (scheduleHours as number)
    : HOURS_PER_DAY;
  const energyKwhPerDay = (powerDraw_W / 1000) * duty * hours;
  const maintenanceCostPerHour = Number.isFinite(device.maintenance?.policy?.baseCostPerHourCc)
    ? device.maintenance.policy.baseCostPerHourCc
    : 0;

  return {
    lightingCoverage: isLighting ? coverage : 0,
    hvacCoverage: isHvac ? coverage : 0,
    airflow_m3_per_h: airflow,
    energyKwhPerDay,
    maintenanceCostPerHour
  } satisfies DeviceContribution;
}

function computeStructureMetrics(structure: Structure): StructureMetrics {
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

function toVolume(area_m2: number, height_m: number): number {
  return area_m2 * height_m;
}

function computeZoneAirflowAch(zone: Zone): number {
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

function mapZoneDevice(device: DeviceInstance): DeviceSummary {
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

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function mapZone(zone: Zone, workforce: WorkforceState): ZoneReadModel {
  const plants = zone.plants;
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
    tasks: mapZoneTasks(zone, workforce)
  } satisfies ZoneReadModel;
}

function mapRoom(structureId: Structure['id'], room: Room, workforce: WorkforceState): RoomReadModel {
  const zones = room.zones.map((zone) => mapZone(zone, workforce));
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

function buildStructureLocation(structure: Structure, companyWorld: ParsedCompanyWorld): string {
  const companyLocation = companyWorld.location;
  return `${companyLocation.cityName}, ${companyLocation.countryName}`;
}

function mapStructure(
  structure: Structure,
  companyWorld: ParsedCompanyWorld,
  workforce: WorkforceState,
  metrics: StructureMetrics
): StructureReadModel {
  const rooms = structure.rooms.map((room) => mapRoom(structure.id, room, workforce));
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

function mapWorkforceWarning(warning: WorkforceWarning) {
  return {
    code: warning.code,
    message: warning.message,
    severity: warning.severity,
    structureId: warning.structureId,
    employeeId: warning.employeeId,
    taskId: warning.taskId
  };
}

function selectEmployeeTaskId(queue: readonly WorkforceTaskInstance[], employeeId: WorkforceEmployee['id']) {
  const active = queue.find(
    (task) => task.assignedEmployeeId === employeeId && task.status === 'in-progress'
  );

  if (active) {
    return active.id;
  }

  const queued = queue.find(
    (task) => task.assignedEmployeeId === employeeId && task.status === 'queued'
  );

  return queued?.id ?? null;
}

function computeNextShiftStartTick(simTimeHours: number, employee: WorkforceEmployee): number | null {
  const shiftStart = employee.schedule.shiftStartHour;

  if (typeof shiftStart !== 'number' || !Number.isFinite(shiftStart)) {
    return null;
  }

  const currentDayStart = Math.floor(simTimeHours / HOURS_PER_DAY) * HOURS_PER_DAY;
  const normalizedStart = Math.min(Math.max(0, shiftStart), HOURS_PER_DAY - 1);
  const sameDayStart = currentDayStart + normalizedStart;

  if (sameDayStart > simTimeHours) {
    return sameDayStart;
  }

  return sameDayStart + HOURS_PER_DAY;
}

function mapWorkforceView(world: SimulationWorld): WorkforceViewReadModel {
  const workforce = world.workforce;
  const roleById = new Map(workforce.roles.map((role) => [role.id, role]));
  type WorkforceRoleKey = 'gardener' | 'technician' | 'janitor';
  const mutableCounts: Record<WorkforceRoleKey, number> = {
    gardener: 0,
    technician: 0,
    janitor: 0
  };

  for (const employee of workforce.employees) {
    const role = roleById.get(employee.roleId);
    switch (role?.slug) {
      case 'gardener':
        mutableCounts.gardener += 1;
        break;
      case 'technician':
        mutableCounts.technician += 1;
        break;
      case 'janitor':
        mutableCounts.janitor += 1;
        break;
      default:
        break;
    }
  }

  const latestKpi = workforce.kpis.at(-1);
  const roster = workforce.employees
    .map((employee) => {
      const role = roleById.get(employee.roleId);
      const currentTaskId = selectEmployeeTaskId(workforce.taskQueue, employee.id);
      const nextShiftStartTick = computeNextShiftStartTick(world.simTimeHours, employee);

      return {
        employeeId: employee.id,
        displayName: employee.name,
        structureId: employee.assignedStructureId,
        roleSlug: role?.slug ?? 'unassigned',
        morale01: clampFraction(employee.morale01),
        fatigue01: clampFraction(employee.fatigue01),
        currentTaskId,
        nextShiftStartTick,
        baseHoursPerDay: roundTo(employee.schedule.hoursPerDay ?? 0, 3),
        overtimeHoursPerDay: roundTo(employee.schedule.overtimeHoursPerDay ?? 0, 3),
        daysPerWeek: employee.schedule.daysPerWeek ?? 0,
        shiftStartHour:
          typeof employee.schedule.shiftStartHour === 'number'
            ? roundTo(Math.max(0, Math.min(23, employee.schedule.shiftStartHour)), 3)
            : null,
        assignment: {
          scope: 'structure' as const,
          targetId: employee.assignedStructureId
        }
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  return {
    schemaVersion: WORKFORCE_VIEW_SCHEMA_VERSION,
    simTime: world.simTimeHours,
    headcount: workforce.employees.length,
    roles: {
      gardener: mutableCounts.gardener,
      technician: mutableCounts.technician,
      janitor: mutableCounts.janitor
    },
    kpis: {
      utilizationPercent: roundTo((latestKpi?.utilization01 ?? 0) * 100, 2),
      overtimeMinutes: Math.round(latestKpi?.overtimeMinutes ?? 0),
      warnings: workforce.warnings.map(mapWorkforceWarning)
    },
    roster
  } satisfies WorkforceViewReadModel;
}

function mapCompanyTree(world: SimulationWorld): CompanyTreeReadModel {
  return {
    schemaVersion: COMPANY_TREE_SCHEMA_VERSION,
    simTime: world.simTimeHours,
    companyId: world.company.id,
    name: world.company.name,
    structures: world.company.structures.map((structure) => ({
      id: structure.id,
      name: structure.name,
      rooms: structure.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        zones: room.zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          area_m2: zone.floorArea_m2,
          volume_m3: toVolume(zone.floorArea_m2, zone.height_m)
        }))
      }))
    }))
  } satisfies CompanyTreeReadModel;
}

function mapStructureTariffs(world: SimulationWorld, config: EngineBootstrapConfig): StructureTariffsReadModel {
  const resolved = createStructureTariffsReadModel(world, config.tariffs);

  return {
    schemaVersion: STRUCTURE_TARIFFS_SCHEMA_VERSION,
    simTime: world.simTimeHours,
    electricity_kwh_price: resolved.rollup.price_electricity,
    water_m3_price: resolved.rollup.price_water,
    co2_kg_price: 0,
    currency: null
  } satisfies StructureTariffsReadModel;
}

function mapSimulationReadModel(world: SimulationWorld): SimulationReadModel {
  const simTime = world.simTimeHours;
  const day = Math.floor(simTime / 24);
  const hour = Math.floor(simTime % 24);

  return {
    simTimeHours: simTime,
    day,
    hour,
    tick: Math.floor(simTime),
    speedMultiplier: 1,
    pendingIncidents: []
  } satisfies SimulationReadModel;
}

function sumLabourCostPerHour(workforce: WorkforceState): number {
  return workforce.employees.reduce((total, employee) => {
    const rate = employee.salaryExpectation_per_h;
    if (!Number.isFinite(rate) || rate <= 0) {
      return total;
    }

    return total + rate;
  }, 0);
}

function mapEconomyReadModel(
  world: SimulationWorld,
  structures: readonly StructureMetrics[],
  workforce: WorkforceState,
  tariffs: EngineBootstrapConfig['tariffs']
): EconomyReadModel {
  const totalEnergyPerDay = structures.reduce((sum, metrics) => sum + metrics.energyKwhPerDay, 0);
  const totalWaterPerDay = structures.reduce((sum, metrics) => sum + metrics.waterM3PerDay, 0);
  const energyPerHour = totalEnergyPerDay / HOURS_PER_DAY;
  const waterPerHour = totalWaterPerDay / HOURS_PER_DAY;
  const energyCostPerHour = energyPerHour * (tariffs.price_electricity ?? 0);
  const waterCostPerHour = waterPerHour * (tariffs.price_water ?? 0);
  const utilitiesCostPerHour = energyCostPerHour + waterCostPerHour;
  const labourCostPerHour = sumLabourCostPerHour(workforce);
  const maintenanceCostPerHour = structures.reduce(
    (sum, metrics) => sum + metrics.maintenanceCostPerHour,
    0
  );
  const operatingCostPerHour = labourCostPerHour + maintenanceCostPerHour + utilitiesCostPerHour;
  const payrollTotals = workforce.payroll?.totals;
  const balanceRaw = payrollTotals ? -roundTo(payrollTotals.totalLaborCost ?? 0, 2) : 0;
  const deltaPerHour = roundTo(-operatingCostPerHour);
  const deltaPerDay = roundTo(deltaPerHour * HOURS_PER_DAY);
  const resolvedTariffs = createStructureTariffsReadModel(world, tariffs);
  const tariffStructures = resolvedTariffs.structures
    .map((entry) => ({
      structureId: entry.structureId,
      price_electricity: entry.effective.price_electricity,
      price_water: entry.effective.price_water
    }))
    .sort((left, right) => left.structureId.localeCompare(right.structureId));

  return {
    balance: sanitizeZero(balanceRaw),
    deltaPerHour: sanitizeZero(deltaPerHour),
    deltaPerDay: sanitizeZero(deltaPerDay),
    operatingCostPerHour: roundTo(operatingCostPerHour),
    labourCostPerHour: roundTo(labourCostPerHour),
    utilitiesCostPerHour: roundTo(utilitiesCostPerHour),
    tariffs: {
      price_electricity: resolvedTariffs.rollup.price_electricity,
      price_water: resolvedTariffs.rollup.price_water,
      structures: tariffStructures
    }
  } satisfies EconomyReadModel;
}

function mapHrReadModel(workforce: WorkforceState): HrReadModel {
  return {
    directory: workforce.employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      role: employee.roleId,
      hourlyCost: employee.salaryExpectation_per_h,
      moralePercent: Math.round(employee.morale01 * 100),
      fatiguePercent: Math.round(employee.fatigue01 * 100),
      skills: employee.skills.map((skill) => skill.skillKey),
      assignment: {
        employeeId: employee.id,
        employeeName: employee.name,
        role: 'structure',
        assignedScope: 'structure',
        targetId: employee.assignedStructureId
      },
      overtimeMinutes: 0
    })),
    activityTimeline: [],
    taskQueues: [],
    capacitySnapshot: []
  } satisfies HrReadModel;
}

function mapPriceBook(world: SimulationWorld): PriceBookCatalog {
  const containerIds = new Set<string>();
  const substrateIds = new Set<string>();
  const irrigationIds = new Set<string>();
  const deviceBlueprints = new Map<
    string,
    { slug: string; coverage_m2: number; airflow_m3_per_h: number }
  >();

  function registerDevice(device: DeviceInstance) {
    if (typeof device.blueprintId !== 'string') {
      return;
    }

    if (!deviceBlueprints.has(device.blueprintId)) {
      deviceBlueprints.set(device.blueprintId, {
        slug: device.slug,
        coverage_m2: Number.isFinite(device.coverage_m2) ? (device.coverage_m2 as number) : 0,
        airflow_m3_per_h: Number.isFinite(device.airflow_m3_per_h)
          ? (device.airflow_m3_per_h as number)
          : 0
      });
    }
  }

  for (const structure of world.company.structures) {
    for (const device of structure.devices) {
      registerDevice(device);
    }

    for (const room of structure.rooms) {
      for (const device of room.devices) {
        registerDevice(device);
      }

      for (const zone of room.zones) {
        containerIds.add(zone.containerId);
        substrateIds.add(zone.substrateId);
        irrigationIds.add(zone.irrigationMethodId);

        for (const device of zone.devices) {
          registerDevice(device);
        }
      }
    }
  }

  const seedlings = Object.entries(STRAIN_PRICE_MAP).map(([strainId, entry]) => ({
    id: `seedling-price-${strainId}`,
    strainId,
    pricePerUnit: roundTo(entry?.seedPrice ?? 0, 2)
  }));

  const containers = Array.from(containerIds).flatMap((id) => {
    const blueprint = resolveContainer(id);
    if (!blueprint) {
      return [];
    }

    const priceEntry = CONSUMABLE_CONTAINER_PRICES[blueprint.slug] as
      | { costPerUnit?: number }
      | undefined;
    const price = priceEntry?.costPerUnit ?? 0;

    return [
      {
        id: `container-price-${blueprint.id}`,
        containerId: blueprint.id,
        capacityLiters: blueprint.volumeInLiters,
        pricePerUnit: roundTo(price, 2),
        serviceLifeCycles: blueprint.reusableCycles ?? 1
      }
    ];
  });

  const substrates = Array.from(substrateIds).flatMap((id) => {
    const blueprint = resolveSubstrate(id);
    if (!blueprint) {
      return [];
    }

    const price =
      blueprint.unitPrice_per_L ??
      (CONSUMABLE_SUBSTRATE_PRICES[blueprint.slug]?.costPerLiter ?? 0);

    return [
      {
        id: `substrate-price-${blueprint.id}`,
        substrateId: blueprint.id,
        unitPrice_per_L: roundTo(price, 4),
        densityFactor_L_per_kg: blueprint.densityFactor_L_per_kg,
        reuseCycles: blueprint.maxCycles
      }
    ];
  });

  const irrigationLines = Array.from(irrigationIds).flatMap((id) => {
    const blueprint = resolveIrrigation(id);
    if (!blueprint) {
      return [];
    }

    return [
      {
        id: `irrigation-price-${blueprint.id}`,
        irrigationMethodId: blueprint.id,
        pricePerSquareMeter: 0
      }
    ];
  });

  const devices = Array.from(deviceBlueprints.entries()).map(([blueprintId, data]) => {
    const priceEntry = DEVICE_PRICE_ENTRIES[blueprintId];
    return {
      id: `device-price-${blueprintId}`,
      deviceSlug: data.slug,
      coverageArea_m2: roundTo(data.coverage_m2, 4),
      throughput_m3_per_hour: roundTo(data.airflow_m3_per_h, 4),
      capitalExpenditure: roundTo(priceEntry?.capitalExpenditure ?? 0, 2)
    } satisfies PriceBookCatalog['devices'][number];
  });

  return {
    seedlings,
    containers,
    substrates,
    irrigationLines,
    devices
  } satisfies PriceBookCatalog;
}

type CultivationBlueprint = (typeof CULTIVATION_BLUEPRINTS)[number];
type IrrigationBlueprint = (typeof IRRIGATION_BLUEPRINTS)[number];

function deriveIrrigationStatus(
  cultivation: CultivationBlueprint,
  irrigation: IrrigationBlueprint
): 'ok' | 'warn' | 'block' {
  const compatibilityMethods = Array.isArray(irrigation.compatibility?.methods)
    ? irrigation.compatibility.methods
    : [];
  const aliasKeys = new Set<string>([cultivation.slug]);

  if (typeof cultivation.technique === 'string' && cultivation.technique.length > 0) {
    aliasKeys.add(cultivation.technique);
  }

  let supported = false;

  for (const method of compatibilityMethods) {
    if (aliasKeys.has(method)) {
      supported = true;
      break;
    }
  }

  if (!supported) {
    return 'block';
  }

  const labour = (irrigation as { labor?: { basis?: string } }).labor;

  if (labour?.basis === 'perPlant') {
    return 'warn';
  }

  return 'ok';
}

function mapCompatibility(): CompatibilityMaps {
  const cultivationEntries = CULTIVATION_BLUEPRINTS.map((cultivation) => {
    const irrigationStatuses = Object.fromEntries(
      IRRIGATION_BLUEPRINTS.map((irrigation) => [
        irrigation.id,
        deriveIrrigationStatus(cultivation, irrigation)
      ])
    );

    return [cultivation.id, irrigationStatuses] as const;
  });

  const strainEntries = Object.keys(STRAIN_PRICE_MAP).map((strainId) => {
    const cultivationStatuses = Object.fromEntries(
      CULTIVATION_BLUEPRINTS.map((cultivation) => [cultivation.id, 'ok' as const])
    );
    const irrigationStatuses = Object.fromEntries(
      IRRIGATION_BLUEPRINTS.map((irrigation) => [irrigation.id, 'ok' as const])
    );

    return [
      strainId,
      {
        cultivation: cultivationStatuses,
        irrigation: irrigationStatuses
      }
    ] as const;
  });

  return {
    cultivationToIrrigation: Object.fromEntries(cultivationEntries),
    strainToCultivation: Object.fromEntries(strainEntries)
  } satisfies CompatibilityMaps;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (!Object.isFrozen(value)) {
      Object.freeze(value);
    }

    if (Array.isArray(value)) {
      for (const element of value) {
        deepFreeze(element);
      }
    } else {
      for (const key of Object.keys(record)) {
        const nested = record[key];
        if (nested && typeof nested === 'object') {
          deepFreeze(nested);
        }
      }
    }
  }

  return value;
}

export function createReadModelProviders(context: EngineContext): ReadModelProviders {
  return {
    async companyTree(): Promise<CompanyTreeReadModel> {
      return mapCompanyTree(context.world);
    },
    async structureTariffs(): Promise<StructureTariffsReadModel> {
      return mapStructureTariffs(context.world, context.config);
    },
    async workforceView(): Promise<WorkforceViewReadModel> {
      return mapWorkforceView(context.world);
    },
    async readModels(): Promise<ReadModelSnapshot> {
      const simulation = mapSimulationReadModel(context.world);
      const rawStructures = context.world.company.structures;
      const structureMetrics = rawStructures.map((structure) => computeStructureMetrics(structure));
      const structures = rawStructures.map((structure, index) =>
        mapStructure(structure, context.companyWorld, context.world.workforce, structureMetrics[index])
      );
      const economy = mapEconomyReadModel(
        context.world,
        structureMetrics,
        context.world.workforce,
        context.config.tariffs
      );
      const hr = mapHrReadModel(context.world.workforce);
      const priceBook = mapPriceBook(context.world);
      const compatibility = mapCompatibility();

      const snapshot = composeReadModelSnapshot({
        simulation,
        economy,
        structures,
        hr,
        priceBook,
        compatibility
      });

      return deepFreeze(snapshot);
    }
  };
}

export type ReadModelProviderFactory = ReturnType<typeof createReadModelProviders>;
