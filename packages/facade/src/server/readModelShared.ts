/* eslint-disable wb-sim/no-ts-import-js-extension */

import type { DeviceInstance, Zone, WorkforceState } from '@wb/engine';
import { HOURS_PER_DAY } from '@engine/constants/time.js';
import {
  parseCultivationMethodBlueprint
} from '@/backend/src/domain/blueprints/cultivationMethodBlueprint.js';
import { parseContainerBlueprint } from '@/backend/src/domain/blueprints/containerBlueprint.js';
import { parseSubstrateBlueprint } from '@/backend/src/domain/blueprints/substrateBlueprint.js';
import { parseIrrigationBlueprint } from '@/backend/src/domain/blueprints/irrigationBlueprint.js';
import { estimateIrrigationCharge } from '@/backend/src/domain/irrigation/waterUsage.js';
import seaOfGreenJson from '../../../../data/blueprints/cultivation-method/sea-of-green.json' with { type: 'json' };
import screenOfGreenJson from '../../../../data/blueprints/cultivation-method/screen-of-green.json' with { type: 'json' };
import basicSoilPotJson from '../../../../data/blueprints/cultivation-method/basic-soil-pot.json' with { type: 'json' };
import pot11Json from '../../../../data/blueprints/container/pot-11l.json' with { type: 'json' };
import pot25Json from '../../../../data/blueprints/container/pot-25l.json' with { type: 'json' };
import pot10Json from '../../../../data/blueprints/container/pot-10l.json' with { type: 'json' };
import cocoCoirJson from '../../../../data/blueprints/substrate/coco-coir.json' with { type: 'json' };
import soilMultiJson from '../../../../data/blueprints/substrate/soil-multi-cycle.json' with { type: 'json' };
import soilSingleJson from '../../../../data/blueprints/substrate/soil-single-cycle.json' with { type: 'json' };
import dripJson from '../../../../data/blueprints/irrigation/drip-inline-fertigation-basic.json' with { type: 'json' };
import manualIrrigationJson from '../../../../data/blueprints/irrigation/manual-watering-can.json' with { type: 'json' };
import devicePricesJson from '../../../../data/prices/devicePrices.json' with { type: 'json' };
import consumablePricesJson from '../../../../data/prices/consumablePrices.json' with { type: 'json' };
import strainPricesJson from '../../../../data/prices/strainPrices.json' with { type: 'json' };
import type { CompanyTreeReadModel } from '../readModels/api/schemas.js';
import {
  type RoomReadModel,
  type ZoneReadModel,
  type StructureWarning
} from '../readModels/snapshot.js';
import { parseDevicePriceMap } from '@/backend/src/domain/pricing/devicePriceMap.js';

export const CULTIVATION_BLUEPRINTS = [
  parseCultivationMethodBlueprint(seaOfGreenJson),
  parseCultivationMethodBlueprint(screenOfGreenJson),
  parseCultivationMethodBlueprint(basicSoilPotJson)
] as const;
export const CULTIVATION_BY_ID = new Map(CULTIVATION_BLUEPRINTS.map((blueprint) => [blueprint.id, blueprint]));

export const CONTAINER_BLUEPRINTS = [
  parseContainerBlueprint(pot11Json),
  parseContainerBlueprint(pot25Json),
  parseContainerBlueprint(pot10Json)
] as const;
export const CONTAINER_BY_ID = new Map(CONTAINER_BLUEPRINTS.map((blueprint) => [blueprint.id, blueprint]));

export const SUBSTRATE_BLUEPRINTS = [
  parseSubstrateBlueprint(cocoCoirJson),
  parseSubstrateBlueprint(soilMultiJson),
  parseSubstrateBlueprint(soilSingleJson)
] as const;
export const SUBSTRATE_BY_ID = new Map(SUBSTRATE_BLUEPRINTS.map((blueprint) => [blueprint.id, blueprint]));
export const SUBSTRATE_SLUG_SET = new Set(SUBSTRATE_BLUEPRINTS.map((blueprint) => blueprint.slug));

export const IRRIGATION_BLUEPRINTS = [
  parseIrrigationBlueprint(dripJson, { knownSubstrateSlugs: SUBSTRATE_SLUG_SET }),
  parseIrrigationBlueprint(manualIrrigationJson, { knownSubstrateSlugs: SUBSTRATE_SLUG_SET })
] as const;
export const IRRIGATION_BY_ID = new Map(IRRIGATION_BLUEPRINTS.map((blueprint) => [blueprint.id, blueprint]));

export const STRUCTURE_LIGHTING_TARGET = 1;
export const STRUCTURE_HVAC_TARGET = 1;
export const STRUCTURE_AIRFLOW_TARGET = 6;
export const ZONE_ACH_TARGET = STRUCTURE_AIRFLOW_TARGET;
export const ZONE_LIGHTING_TARGET = STRUCTURE_LIGHTING_TARGET;
export const ZONE_HVAC_TARGET = STRUCTURE_HVAC_TARGET;

export const DEVICE_PRICE_ENTRIES = parseDevicePriceMap(devicePricesJson).devicePrices;
export const CONSUMABLE_CONTAINER_PRICES = (consumablePricesJson?.containers ?? {}) as Record<
  string,
  { costPerUnit?: number }
>;
export const CONSUMABLE_SUBSTRATE_PRICES = (consumablePricesJson?.substrates ?? {}) as Record<
  string,
  { costPerLiter?: number }
>;
export const STRAIN_PRICE_MAP = (strainPricesJson?.strainPrices ?? {}) as Record<
  string,
  { seedPrice?: number; harvestPricePerGram?: number }
>;

export function clampFraction(value: number | undefined): number {
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

export function roundTo(value: number, digits = 6): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number.parseFloat(value.toFixed(digits));
}

/** Converts a rectangular floor area and height to cubic metres. */
export function toVolume(area_m2: number, height_m: number): number {
  return area_m2 * height_m;
}

export function sanitizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

export interface StructureMetrics {
  readonly lightingCoverage01: number;
  readonly hvacCapacity01: number;
  readonly airflowAch: number;
  readonly energyKwhPerDay: number;
  readonly waterM3PerDay: number;
  readonly labourHoursPerDay: number;
  readonly maintenanceCostPerHour: number;
  readonly coverageWarnings: readonly StructureWarning[];
}

export type ZoneTaskEntry = ZoneReadModel['tasks'][number];
export type ZoneDeviceWarning = ZoneReadModel['coverageWarnings'][number];
export type WorkforceTaskInstance = WorkforceState['taskQueue'][number];
export type WorkforceEmployee = WorkforceState['employees'][number];
export type CompanyTreeStructureNode = CompanyTreeReadModel['structures'][number];
export type CompanyTreeRoomNode = CompanyTreeStructureNode['rooms'][number];
export type CompanyTreeZoneNode = CompanyTreeRoomNode['zones'][number];
export type CompanyTreeDeviceWarning = CompanyTreeZoneNode['warnings'][number];
export type CompanyTreeWarningEnvelope = CompanyTreeStructureNode['warnings'][number];

/** Narrows a validated world identifier to the branded UUID used by API read-model schemas. */
export function asReadModelUuid(value: string): CompanyTreeReadModel['companyId'] {
  return value as CompanyTreeReadModel['companyId'];
}
export type CompanyTreeZoneLightingSchedule = NonNullable<CompanyTreeZoneNode['lighting']['schedule']>;
export type CompanyTreeZoneContainerContext = NonNullable<CompanyTreeZoneNode['cultivation']['container']>;
export type CompanyTreeZoneSubstrateContext = NonNullable<CompanyTreeZoneNode['cultivation']['substrate']>;
export type CompanyTreeZoneStrainContext = NonNullable<CompanyTreeZoneNode['cultivation']['strain']>;
export type CompanyTreeZoneClimateTelemetrySample = CompanyTreeZoneNode['climate']['telemetry'][number];
export type CompanyTreeRoomClimateTelemetrySample = CompanyTreeRoomNode['climate']['telemetry'][number];

export const ZONE_TASK_TYPE_MAP: Record<string, ZoneTaskEntry['type']> = {
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

export const WORKFORCE_STATUS_MAP: Record<WorkforceTaskInstance['status'], ZoneTaskEntry['status']> = {
  queued: 'queued',
  'in-progress': 'in-progress',
  completed: 'done',
  cancelled: 'done'
};

export function resolveZoneTaskType(taskCode: string): ZoneTaskEntry['type'] {
  return ZONE_TASK_TYPE_MAP[taskCode] ?? 'maintenance';
}

export function resolveZoneTaskStatus(status: WorkforceTaskInstance['status']): ZoneTaskEntry['status'] {
  return WORKFORCE_STATUS_MAP[status] ?? 'queued';
}

export function extractTaskZoneId(task: WorkforceTaskInstance): string | null {
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

export function mapZoneTasks(zone: Zone, workforce: WorkforceState): ZoneTaskEntry[] {
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

export function createZoneAirflowWarning(zone: Zone, ach: number): ZoneDeviceWarning | null {
  if (!(ach < ZONE_ACH_TARGET)) {
    return null;
  }

  return {
    id: `${zone.id}:airflow`,
    message: `Air changes at ${ach.toFixed(2)} ACH (target ${ZONE_ACH_TARGET}).`,
    severity: 'warning'
  } satisfies ZoneDeviceWarning;
}

export interface DeviceContribution {
  readonly lightingCoverage: number;
  readonly hvacCoverage: number;
  readonly airflow_m3_per_h: number;
  readonly energyKwhPerDay: number;
  readonly maintenanceCostPerHour: number;
}

export function computeDeviceContribution(
  device: DeviceInstance,
  scheduleHours?: number,
): DeviceContribution {
  const effects = Array.isArray(device.effects) ? device.effects : [];
  const isLighting = effects.includes('lighting');
  const isHvac =
    !isLighting &&
    effects.some((effect) => effect === 'thermal' || effect === 'humidity' || effect === 'airflow');
  const coverage =
    Number.isFinite(device.coverage_m2) && device.coverage_m2 > 0 ? device.coverage_m2 : 0;
  const airflow =
    Number.isFinite(device.airflow_m3_per_h) && device.airflow_m3_per_h > 0
      ? device.airflow_m3_per_h
      : 0;
  const duty = clampFraction(device.dutyCycle01 ?? 1);
  const powerDraw_W =
    Number.isFinite(device.powerDraw_W) && device.powerDraw_W > 0 ? device.powerDraw_W : 0;
  const hours = isLighting && Number.isFinite(scheduleHours) ? (scheduleHours as number) : HOURS_PER_DAY;
  const maintenanceCostPerHour = device.maintenance?.policy?.baseCostPerHourCc;

  return {
    lightingCoverage: isLighting ? coverage : 0,
    hvacCoverage: isHvac ? coverage : 0,
    airflow_m3_per_h: airflow,
    energyKwhPerDay: (powerDraw_W / 1000) * duty * hours,
    maintenanceCostPerHour: Number.isFinite(maintenanceCostPerHour)
      ? (maintenanceCostPerHour as number)
      : 0,
  } satisfies DeviceContribution;
}

export function resolveCultivationMethod(
  id: string,
): (typeof CULTIVATION_BLUEPRINTS)[number] | undefined {
  return CULTIVATION_BY_ID.get(id);
}

export function resolveContainer(id: string): (typeof CONTAINER_BLUEPRINTS)[number] | undefined {
  return CONTAINER_BY_ID.get(id);
}

export function resolveSubstrate(id: string): (typeof SUBSTRATE_BLUEPRINTS)[number] | undefined {
  return SUBSTRATE_BY_ID.get(id);
}

export function resolveIrrigation(id: string): (typeof IRRIGATION_BLUEPRINTS)[number] | undefined {
  return IRRIGATION_BY_ID.get(id);
}

export function computePlantCount(zone: Zone): number {
  const method = resolveCultivationMethod(zone.cultivationMethodId);
  const areaPerPlant = method?.areaPerPlant_m2;

  if (!Number.isFinite(areaPerPlant) || (areaPerPlant ?? 0) <= 0) {
    return Math.max(1, Math.round(zone.floorArea_m2));
  }

  return Math.max(1, Math.floor(zone.floorArea_m2 / (areaPerPlant ?? 1)));
}

export function computeCultivationLabourHours(zone: Zone, plantCount: number): number {
  const method = resolveCultivationMethod(zone.cultivationMethodId);
  const hoursPerPlantPerWeek = method?.laborProfile?.hoursPerPlantPerWeek;

  if (!Number.isFinite(hoursPerPlantPerWeek) || (hoursPerPlantPerWeek ?? 0) <= 0) {
    return 0;
  }

  return (hoursPerPlantPerWeek ?? 0) * plantCount / 7;
}

export function computeIrrigationLabourHours(zone: Zone, plantCount: number): number {
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

export function computeZoneWaterM3PerDay(zone: Zone, plantCount: number): number {
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

export function createZoneLightingWarning(zone: Zone, coverage01: number): ZoneDeviceWarning | null {
  if (!(coverage01 < ZONE_LIGHTING_TARGET)) {
    return null;
  }

  return {
    id: `${zone.id}:lighting`,
    message: `Lighting coverage at ${(coverage01 * 100).toFixed(2)}% of demand.`,
    severity: 'warning'
  } satisfies ZoneDeviceWarning;
}

export function createZoneHvacWarning(zone: Zone, coverage01: number): ZoneDeviceWarning | null {
  if (!(coverage01 < ZONE_HVAC_TARGET)) {
    return null;
  }

  return {
    id: `${zone.id}:hvac`,
    message: `HVAC coverage at ${(coverage01 * 100).toFixed(2)}% of demand.`,
    severity: 'warning'
  } satisfies ZoneDeviceWarning;
}

export interface ZoneCoverageMetrics {
  readonly lightingCoverage01: number;
  readonly hvacCapacity01: number;
  readonly airflowAch: number;
  readonly warnings: readonly ZoneDeviceWarning[];
}

export function computeZoneCoverageMetrics(zone: Zone): ZoneCoverageMetrics {
  const area = zone.floorArea_m2 > 0 ? zone.floorArea_m2 : 0;
  const volume = toVolume(zone.floorArea_m2, zone.height_m);

  let lightingCoverage = 0;
  let hvacCoverage = 0;
  let airflowTotal = 0;

  for (const device of zone.devices) {
    const contribution = computeDeviceContribution(device, zone.lightSchedule?.onHours);
    lightingCoverage += contribution.lightingCoverage;
    hvacCoverage += contribution.hvacCoverage;
    airflowTotal += contribution.airflow_m3_per_h;
  }

  const lightingCoverage01 = area > 0 ? lightingCoverage / area : 0;
  const hvacCapacity01 = area > 0 ? hvacCoverage / area : 0;
  const airflowAch = volume > 0 ? airflowTotal / volume : 0;

  const warnings: ZoneDeviceWarning[] = [];
  const lightingWarning = createZoneLightingWarning(zone, lightingCoverage01);
  if (lightingWarning) {
    warnings.push(lightingWarning);
  }

  const hvacWarning = createZoneHvacWarning(zone, hvacCapacity01);
  if (hvacWarning) {
    warnings.push(hvacWarning);
  }

  const airflowWarning = createZoneAirflowWarning(zone, airflowAch);
  if (airflowWarning) {
    warnings.push(airflowWarning);
  }

  warnings.sort((left, right) => left.id.localeCompare(right.id));

  return {
    lightingCoverage01: roundTo(lightingCoverage01),
    hvacCapacity01: roundTo(hvacCapacity01),
    airflowAch: roundTo(airflowAch),
    warnings
  } satisfies ZoneCoverageMetrics;
}

export function dedupeWarnings<T extends { id: string }>(warnings: readonly T[]): T[] {
  const map = new Map<string, T>();

  for (const warning of warnings) {
    if (!map.has(warning.id)) {
      map.set(warning.id, warning);
    }
  }

  return Array.from(map.values()).sort((left, right) => left.id.localeCompare(right.id));
}

export function dedupeWarningEnvelopes(
  warnings: readonly CompanyTreeWarningEnvelope[]
): CompanyTreeWarningEnvelope[] {
  const map = new Map<string, CompanyTreeWarningEnvelope>();

  for (const warning of warnings) {
    const key = `${warning.scope}:${warning.targetId ?? ''}:${warning.id}`;
    if (!map.has(key)) {
      map.set(key, warning);
    }
  }

  return Array.from(map.values()).sort((left, right) => left.id.localeCompare(right.id));
}

export function createZoneClimateStatusWarning(
  zoneId: Zone['id'],
  snapshot: ZoneReadModel['climateSnapshot']
): CompanyTreeDeviceWarning | null {
  if (snapshot.status === 'ok') {
    return null;
  }

  const severity = snapshot.status === 'critical' ? 'critical' : 'warning';

  return {
    id: `${zoneId}:climate`,
    message: `Climate status reported as ${snapshot.status}.`,
    severity
  } satisfies CompanyTreeDeviceWarning;
}

export function mapCultivationMethodContext(
  zone: Zone,
): CompanyTreeZoneNode['cultivation']['method'] {
  const blueprint = resolveCultivationMethod(zone.cultivationMethodId);

  if (!blueprint) {
    return {
      id: asReadModelUuid(zone.cultivationMethodId),
      slug: 'unknown-cultivation',
      name: 'Unknown cultivation method'
    } satisfies CompanyTreeZoneNode['cultivation']['method'];
  }

  return {
    id: asReadModelUuid(blueprint.id),
    slug: blueprint.slug,
    name: blueprint.name
  } satisfies CompanyTreeZoneNode['cultivation']['method'];
}

export function mapContainerContext(zone: Zone): CompanyTreeZoneContainerContext | undefined {
  const blueprint = resolveContainer(zone.containerId);

  if (!blueprint) {
    return undefined;
  }

  const unitCost = CONSUMABLE_CONTAINER_PRICES[blueprint.slug]?.costPerUnit;
  const volume = Number.isFinite(blueprint.volumeInLiters) ? (blueprint.volumeInLiters as number) : 0;
  const serviceLife = Number.isFinite((blueprint as { reusableCycles?: number }).reusableCycles)
    ? Math.max(0, (blueprint as { reusableCycles?: number }).reusableCycles ?? 0)
    : 0;

  return {
    id: asReadModelUuid(blueprint.id),
    slug: blueprint.slug,
    name: blueprint.name,
    volume_L: roundTo(Math.max(volume, 0)),
    serviceLife_cycles: Math.round(serviceLife),
    unitCost: roundTo(typeof unitCost === 'number' ? unitCost : 0)
  } satisfies CompanyTreeZoneContainerContext;
}

export function mapSubstrateContext(zone: Zone): CompanyTreeZoneSubstrateContext | undefined {
  const blueprint = resolveSubstrate(zone.substrateId);

  if (!blueprint) {
    return undefined;
  }

  const priceEntry = CONSUMABLE_SUBSTRATE_PRICES[blueprint.slug]?.costPerLiter;
  const unitPrice =
    typeof priceEntry === 'number'
      ? priceEntry
      : Number.isFinite(blueprint.unitPrice_per_L)
      ? (blueprint.unitPrice_per_L as number)
      : 0;
  const density = Number.isFinite(blueprint.densityFactor_L_per_kg)
    ? (blueprint.densityFactor_L_per_kg as number)
    : 0;

  return {
    id: asReadModelUuid(blueprint.id),
    slug: blueprint.slug,
    name: blueprint.name,
    unitPrice_per_L: roundTo(Math.max(unitPrice, 0)),
    densityFactor_L_per_kg: roundTo(Math.max(density, 0))
  } satisfies CompanyTreeZoneSubstrateContext;
}

export function mapIrrigationMethodContext(
  zone: Zone,
): CompanyTreeZoneNode['irrigation']['method'] {
  const blueprint = resolveIrrigation(zone.irrigationMethodId);

  if (!blueprint) {
    return {
      id: asReadModelUuid(zone.irrigationMethodId),
      slug: 'unknown-irrigation',
      name: 'Unknown irrigation method',
      deliveryType: undefined
    } satisfies CompanyTreeZoneNode['irrigation']['method'];
  }

  const deliveryTypeCandidate =
    typeof (blueprint as { method?: string }).method === 'string' && (blueprint as { method?: string }).method!.length > 0
      ? (blueprint as { method?: string }).method
      : typeof (blueprint as { control?: string }).control === 'string' &&
        (blueprint as { control?: string }).control!.length > 0
      ? (blueprint as { control?: string }).control
      : undefined;

  return {
    id: asReadModelUuid(blueprint.id),
    slug: blueprint.slug,
    name: blueprint.name,
    deliveryType: deliveryTypeCandidate
  } satisfies CompanyTreeZoneNode['irrigation']['method'];
}

export function resolveZoneStrainContext(strainId: string | null | undefined): CompanyTreeZoneStrainContext | undefined {
  if (typeof strainId !== 'string' || strainId.length === 0) {
    return undefined;
  }

  return {
    id: asReadModelUuid(strainId),
    name: 'Unknown strain'
  } satisfies CompanyTreeZoneStrainContext;
}

export function normalizeLightSchedule(zone: Zone): CompanyTreeZoneLightingSchedule | null {
  const schedule = zone.lightSchedule;

  if (!schedule) {
    return null;
  }

  const onHours = Number.isFinite(schedule.onHours) ? (schedule.onHours as number) : 0;
  const offHoursRaw = Number.isFinite(schedule.offHours) ? (schedule.offHours as number) : HOURS_PER_DAY - onHours;
  const offHours = Math.max(0, offHoursRaw);
  const startHour = Number.isFinite(schedule.startHour) ? (schedule.startHour as number) : 0;

  return {
    onHours: roundTo(Math.max(onHours, 0), 3),
    offHours: roundTo(offHours, 3),
    startHour: roundTo(Math.max(startHour, 0), 3)
  } satisfies CompanyTreeZoneLightingSchedule;
}

export function computeLightingDutyFraction(schedule: Zone['lightSchedule'] | undefined): number {
  if (!schedule) {
    return 1;
  }

  const onHours = Number.isFinite(schedule.onHours) ? (schedule.onHours as number) : 0;
  const offHours = Number.isFinite(schedule.offHours) ? (schedule.offHours as number) : Math.max(0, HOURS_PER_DAY - onHours);
  const total = onHours + offHours;

  if (!(total > 0)) {
    return 1;
  }

  const fraction = Math.max(0, Math.min(1, onHours / total));
  return roundTo(fraction);
}

export function createZoneClimateTelemetrySample(
  simTimeHours: number,
  snapshot: ZoneReadModel['climateSnapshot']
): CompanyTreeZoneClimateTelemetrySample {
  return {
    simTimeHours,
    temperature_C: snapshot.temperature_C,
    relativeHumidity_percent: snapshot.relativeHumidity_percent,
    co2_ppm: snapshot.co2_ppm,
    vpd_kPa: snapshot.vpd_kPa,
    ach: snapshot.ach_measured
  } satisfies CompanyTreeZoneClimateTelemetrySample;
}

export function createRoomClimateTelemetrySample(
  simTimeHours: number,
  snapshot: RoomReadModel['climateSnapshot']
): CompanyTreeRoomClimateTelemetrySample {
  return {
    simTimeHours,
    temperature_C: snapshot.temperature_C,
    relativeHumidity_percent: snapshot.relativeHumidity_percent,
    co2_ppm: snapshot.co2_ppm,
    ach: snapshot.ach
  } satisfies CompanyTreeRoomClimateTelemetrySample;
}
