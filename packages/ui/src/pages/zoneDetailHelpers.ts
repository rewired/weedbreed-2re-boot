import { HOURS_PER_DAY } from "@engine/constants/simConstants.ts";
import type { DeviceSummary, RoomReadModel, TimelineEntry, ZoneReadModel, ZoneTaskEntry } from "@ui/state/readModels.types";
import type { ZoneActionButton, ZoneDeviceControl, ZoneDeviceGroup, ZoneDeviceTile } from "./zoneDetailHooks";

const formatterWhole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
const formatterOneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const formatterTwoDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const ZONE_STAGE_BASELINES = Object.freeze({
  vegetative: Object.freeze({ temperature_C: 24, relativeHumidity_percent: 63, co2_ppm: 900, vpd_kPa: 0.92 }),
  flowering: Object.freeze({ temperature_C: 24, relativeHumidity_percent: 55, co2_ppm: 1100, vpd_kPa: 1.1 }),
  propagation: Object.freeze({ temperature_C: 23, relativeHumidity_percent: 75, co2_ppm: 850, vpd_kPa: 0.7 }),
  drying: Object.freeze({ temperature_C: 20, relativeHumidity_percent: 50, co2_ppm: 450, vpd_kPa: 1 }),
  default: Object.freeze({ temperature_C: 23, relativeHumidity_percent: 60, co2_ppm: 800, vpd_kPa: 0.95 })
});
const ZONE_STAGE_LIGHTING_TARGETS = Object.freeze({ vegetative: 550, flowering: 780, propagation: 320, drying: 180, default: 500 });
type PercentMetric = "health" | "quality" | "stress";

export function buildZoneDeviceGroups(
  structureId: string,
  roomId: string | null,
  zone: ZoneReadModel
): ZoneDeviceGroup[] {
  const groups = new Map<string, ZoneDeviceGroupBuilder>();

  for (const device of zone.devices) {
    const groupId = device.class;
    const group = groups.get(groupId) ?? createDeviceGroupBuilder(groupId);
    group.devices.push(createDeviceTile(zone, device));
    groups.set(groupId, group);
  }

  for (const warning of zone.coverageWarnings) {
    const targetGroupId = inferWarningGroup(warning.message);
    if (!targetGroupId) {
      continue;
    }
    const group = groups.get(targetGroupId) ?? createDeviceGroupBuilder(targetGroupId);
    group.warnings.push(warning.message);
    groups.set(targetGroupId, group);
  }

  return Array.from(groups.values()).map((group) => ({
    id: group.id,
    title: formatDeviceClass(group.id),
    warnings: group.warnings,
    devices: group.devices,
    controls: createDeviceControlActions(structureId, roomId, zone.id, group.id)
  }));
}

interface ZoneDeviceGroupBuilder {
  readonly id: string;
  readonly devices: ZoneDeviceTile[];
  readonly warnings: string[];
}

export function createDeviceGroupBuilder(id: string): ZoneDeviceGroupBuilder {
  return { id, devices: [], warnings: [] } satisfies ZoneDeviceGroupBuilder;
}

export function createDeviceTile(zone: ZoneReadModel, device: DeviceSummary): ZoneDeviceTile {
  const conditionLabel = `${formatterWhole.format(Math.round(device.conditionPercent))}% condition`;
  const contributionLabel = buildContributionLabel(zone, device);
  const capLabel = buildCapLabel(zone, device);

  const warnings = [...device.warnings.map((warning) => warning.message)];

  if (needsCoverageWarning(zone, device)) {
    warnings.push(`${formatDeviceClass(device.class)} coverage below target.`);
  }

  return {
    id: device.id,
    name: device.name,
    conditionLabel,
    contributionLabel,
    capLabel,
    warnings
  } satisfies ZoneDeviceTile;
}

export function buildContributionLabel(zone: ZoneReadModel, device: DeviceSummary): string {
  if (device.coverageArea_m2 > 0) {
    const areaPercent = computeCoveragePercent(device.coverageArea_m2, zone.area_m2);
    return `${formatArea(device.coverageArea_m2)} coverage (${formatterWhole.format(areaPercent)}%)`;
  }

  if (device.airflow_m3_per_hour > 0) {
    const airflowPercent = computeCoveragePercent(device.airflow_m3_per_hour, zone.volume_m3);
    return `${formatAirflow(device.airflow_m3_per_hour)} airflow (${formatterWhole.format(airflowPercent)}%)`;
  }

  if (device.powerDraw_kWh_per_hour > 0) {
    return `${formatterOneDecimal.format(device.powerDraw_kWh_per_hour)} kWh per hour`;
  }

  return "Contribution data pending";
}

export function buildCapLabel(zone: ZoneReadModel, device: DeviceSummary): string {
  if (device.coverageArea_m2 > 0) {
    const percent = Math.min(100, computeCoveragePercent(device.coverageArea_m2, zone.area_m2));
    return `Cap ${formatterWhole.format(percent)}% of zone area`;
  }

  if (device.airflow_m3_per_hour > 0) {
    const percent = Math.min(100, computeCoveragePercent(device.airflow_m3_per_hour, zone.volume_m3));
    return `Cap ${formatterWhole.format(percent)}% of airflow demand`;
  }

  return "Cap data pending";
}

export function needsCoverageWarning(zone: ZoneReadModel, device: DeviceSummary): boolean {
  if (device.coverageArea_m2 > 0) {
    return computeCoveragePercent(device.coverageArea_m2, zone.area_m2) < 95;
  }

  if (device.airflow_m3_per_hour > 0) {
    return computeCoveragePercent(device.airflow_m3_per_hour, zone.volume_m3) < 95;
  }

  return false;
}

export function createDeviceControlActions(
  _structureId: string,
  _roomId: string | null,
  _zoneId: string,
  groupId: string
): ZoneDeviceControl[] {
  void _structureId;
  void _roomId;
  void _zoneId;
  void groupId;
  return [];
}

export function lookupDeviceControl(groupId: string): DeviceControlConfig | null {
  if (Object.prototype.hasOwnProperty.call(DEVICE_CONTROL_COPY, groupId)) {
    return DEVICE_CONTROL_COPY[groupId as keyof typeof DEVICE_CONTROL_COPY];
  }
  return null;
}

interface DeviceControlConfig {
  readonly label: string;
  readonly disabledReason: string;
}

const DEVICE_CONTROL_COPY = {
  lighting: {
    label: "Adjust lighting targets",
    disabledReason: "Lighting target intents land with Task 0035."
  },
  irrigation: {
    label: "Adjust irrigation cadence",
    disabledReason: "Irrigation command wiring arrives with Task 0036."
  },
  climate: {
    label: "Tune climate targets",
    disabledReason: "Climate control intents ship with Task 0040."
  },
  airflow: {
    label: "Tune airflow targets",
    disabledReason: "Airflow balancing flows arrive with Task 0041."
  }
} as const satisfies Readonly<Record<string, DeviceControlConfig>>;

export function buildZoneActions(
  _structureId: string,
  _roomId: string | null,
  _zone: ZoneReadModel
): ZoneActionButton[] {
  void _structureId;
  void _roomId;
  void _zone;
  return [];
}

export function buildDeviceControls(
  structureId: string,
  roomId: string | null,
  zone: ZoneReadModel
): ZoneDeviceControl[] {
  const seen = new Set<string>();
  const controls: ZoneDeviceControl[] = [];

  for (const device of zone.devices) {
    const actions = createDeviceControlActions(structureId, roomId, zone.id, device.class);
    for (const action of actions) {
      if (seen.has(action.id)) {
        continue;
      }
      seen.add(action.id);
      controls.push(action);
    }
  }

  for (const warning of zone.coverageWarnings) {
    const groupId = inferWarningGroup(warning.message);
    if (!groupId) {
      continue;
    }
    const actions = createDeviceControlActions(structureId, roomId, zone.id, groupId);
    for (const action of actions) {
      if (seen.has(action.id)) {
        continue;
      }
      seen.add(action.id);
      controls.push(action);
    }
  }

  return controls;
}

export function formatArea(value: number): string {
  return `${formatterWhole.format(Math.round(Math.max(value, 0)))} m²`;
}

export function formatVolume(value: number): string {
  return `${formatterWhole.format(Math.round(Math.max(value, 0)))} m³`;
}

export function formatAirflow(value: number): string {
  return `${formatterWhole.format(Math.round(Math.max(value, 0)))} m³/h`;
}

export function formatPlants(value: number): string {
  return formatterWhole.format(Math.round(Math.max(value, 0)));
}

export function computeDensity(plants: number, area: number): number {
  if (area <= 0) {
    return 0;
  }
  return Math.max(plants, 0) / area;
}

export function computeCoveragePercent(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((Math.max(value, 0) / total) * 100);
}

export function metricLabel(metric: PercentMetric): string {
  switch (metric) {
    case "health":
      return "Plant health";
    case "quality":
      return "Quality";
    case "stress":
      return "Stress";
    default:
      return metric;
  }
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

export function clamp01(value: number): number {
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

export function roundPercent(value: number): number {
  return Math.round(clampPercent(value));
}

export function formatSlug(slug: string): string {
  if (!slug) {
    return "—";
  }

  const cleaned = slug.replace(/^cm-/, "").replace(/^ir-/, "").replace(/^strain-/, "");
  return cleaned
    .split(/[-_.]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function deriveZoneStageLabel(zone: ZoneReadModel): string {
  const lowerName = zone.name.toLowerCase();
  if (lowerName.includes("veg")) {
    return "Vegetative";
  }
  if (lowerName.includes("flower")) {
    return "Flowering";
  }
  if (lowerName.includes("prop")) {
    return "Propagation";
  }
  if (lowerName.includes("dry")) {
    return "Drying";
  }
  return "Cultivation";
}

export function formatTick(tick: number | null | undefined): string {
  if (typeof tick !== "number" || !Number.isFinite(tick)) {
    return "—";
  }

  const safeTick = Math.max(0, Math.floor(tick));
  const day = Math.floor(safeTick / HOURS_PER_DAY) + 1;
  const hour = safeTick % HOURS_PER_DAY;
  const hourLabel = hour.toString().padStart(2, "0");

  return `Day ${formatterWhole.format(day)}, ${hourLabel}:00`;
}

export function findLastTreatmentTimestamp(timeline: readonly TimelineEntry[]): number | null {
  let timestamp: number | null = null;

  for (const entry of timeline) {
    const matchesTreatment = /treat/i.test(entry.title) || /treat/i.test(entry.description);
    if (!matchesTreatment) {
      continue;
    }
    if (timestamp === null || entry.timestamp > timestamp) {
      timestamp = entry.timestamp;
    }
  }

  return timestamp;
}

export function findNextTreatmentTick(tasks: readonly ZoneTaskEntry[]): number | null {
  let nextTick: number | null = null;

  for (const task of tasks) {
    if (task.type !== "treatment") {
      continue;
    }

    if (task.status === "done") {
      continue;
    }

    if (!Number.isFinite(task.scheduledTick)) {
      continue;
    }

    if (nextTick === null || task.scheduledTick < nextTick) {
      nextTick = task.scheduledTick;
    }
  }

  return nextTick;
}

export function formatStatus(status: TimelineEntry["status"]): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "in-progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "blocked":
      return "Blocked";
    default:
      return "Pending";
  }
}

export function selectStageBaseline(
  zone: ZoneReadModel,
  room: RoomReadModel | null
): (typeof ZONE_STAGE_BASELINES)[keyof typeof ZONE_STAGE_BASELINES] {
  const stage = deriveZoneStageLabel(zone).toLowerCase();

  if (stage.startsWith("veg")) {
    return ZONE_STAGE_BASELINES.vegetative;
  }

  if (stage.startsWith("flow")) {
    return ZONE_STAGE_BASELINES.flowering;
  }

  if (stage.startsWith("prop")) {
    return ZONE_STAGE_BASELINES.propagation;
  }

  if (stage.startsWith("dry")) {
    return ZONE_STAGE_BASELINES.drying;
  }

  if (room?.name.toLowerCase().includes("dry")) {
    return ZONE_STAGE_BASELINES.drying;
  }

  return ZONE_STAGE_BASELINES.default;
}

export function inferLightingTargetFromText(text: string | null | undefined): number {
  if (!text) {
    return ZONE_STAGE_LIGHTING_TARGETS.default;
  }

  const normalized = text.toLowerCase();

  if (normalized.includes("veg")) {
    return ZONE_STAGE_LIGHTING_TARGETS.vegetative;
  }

  if (normalized.includes("flow") || normalized.includes("bloom")) {
    return ZONE_STAGE_LIGHTING_TARGETS.flowering;
  }

  if (normalized.includes("prop") || normalized.includes("clone") || normalized.includes("nursery")) {
    return ZONE_STAGE_LIGHTING_TARGETS.propagation;
  }

  if (normalized.includes("dry") || normalized.includes("cure")) {
    return ZONE_STAGE_LIGHTING_TARGETS.drying;
  }

  return ZONE_STAGE_LIGHTING_TARGETS.default;
}

export function selectStageLightingTarget(zone: ZoneReadModel, room: RoomReadModel | null): number {
  const stageLabelTarget = inferLightingTargetFromText(deriveZoneStageLabel(zone));
  if (stageLabelTarget !== ZONE_STAGE_LIGHTING_TARGETS.default) {
    return stageLabelTarget;
  }

  const zoneNameTarget = inferLightingTargetFromText(zone.name);
  if (zoneNameTarget !== ZONE_STAGE_LIGHTING_TARGETS.default) {
    return zoneNameTarget;
  }

  const roomNameTarget = inferLightingTargetFromText(room?.name);
  if (roomNameTarget !== ZONE_STAGE_LIGHTING_TARGETS.default) {
    return roomNameTarget;
  }

  return ZONE_STAGE_LIGHTING_TARGETS.default;
}

export function selectRoomLightingFallbackTarget(room: RoomReadModel | null): number {
  if (!room) {
    return ZONE_STAGE_LIGHTING_TARGETS.default;
  }

  const roomNameTarget = inferLightingTargetFromText(room.name);
  if (roomNameTarget !== ZONE_STAGE_LIGHTING_TARGETS.default) {
    return roomNameTarget;
  }

  if (room.purpose === "storageroom") {
    return ZONE_STAGE_LIGHTING_TARGETS.drying;
  }

  return ZONE_STAGE_LIGHTING_TARGETS.default;
}

export function deriveClimateStatus(
  measured: number,
  target: number,
  tolerance: number
): "ok" | "warn" | "critical" {
  if (!Number.isFinite(measured) || !Number.isFinite(target)) {
    return "warn";
  }

  const delta = Math.abs(measured - target);

  if (delta <= tolerance) {
    return "ok";
  }

  if (delta <= tolerance * 2) {
    return "warn";
  }

  return "critical";
}

export function statusLabel(status: "ok" | "warn" | "critical"): string {
  switch (status) {
    case "ok":
      return "Within range";
    case "warn":
      return "Needs attention";
    case "critical":
      return "Check immediately";
    default:
      return "Pending";
  }
}

export function formatMeasuredValue(metricId: string, value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  switch (metricId) {
    case "temperature":
      return `${formatterOneDecimal.format(value)} °C`;
    case "humidity":
      return `${formatterWhole.format(Math.round(value))}%`;
    case "co2":
      return `${formatterWhole.format(Math.round(value))} ppm`;
    case "vpd":
      return `${formatterTwoDecimal.format(value)} kPa`;
    case "ach":
      return `${formatterTwoDecimal.format(value)} ACH`;
    default:
      return formatterOneDecimal.format(value);
  }
}

export function inferWarningGroup(message: string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes("light")) {
    return "lighting";
  }
  if (lower.includes("irrigation") || lower.includes("drip")) {
    return "irrigation";
  }
  if (lower.includes("air") || lower.includes("ach")) {
    return "airflow";
  }
  if (lower.includes("climate") || lower.includes("hvac")) {
    return "climate";
  }
  return null;
}

export function formatDeviceClass(classId: string): string {
  return formatSlug(classId);
}

/* eslint-enable @typescript-eslint/no-magic-numbers */
