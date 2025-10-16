import { useMemo } from "react";
import {
  type ControlCardDeviationThresholds,
  type ControlCardGhostPlaceholderDefinition,
  type ControlCardMetricValue
} from "@ui/components/controls/ControlCard";
import type {
  ClimateControlDeviceClassSection,
  ClimateControlDeviceTileProps,
  ClimateControlMetricDefinition
} from "@ui/components/controls/ClimateControlCard";
import type { LightingDeviceTileProps } from "@ui/components/controls/LightingControlCard";
import { buildZonePath } from "@ui/lib/navigation";
import { normalizeLightSchedule, type LightScheduleInput } from "@ui/lib/lightScheduleValidation";
import { useRoomReadModel, useStructureReadModel } from "@ui/lib/readModelHooks";
import { recordZoneLightSchedule, useZoneLightSchedule } from "@ui/state/intents";
import { useTelemetryStore, type TelemetryZoneSnapshotPayload } from "@ui/state/telemetry";
import {
  CAPACITY_ADVISOR_ACTION_LABEL,
  selectStageLightingTarget,
  selectRoomLightingFallbackTarget,
  RELEVANT_CLIMATE_CLASSES,
  REQUIRED_CLIMATE_CLASSES
} from "@ui/pages/zoneDetailHooks";
import type {
  DeviceSummary,
  RoomReadModel,
  StructureReadModel,
  TimelineEntry,
  ZoneReadModel
} from "@ui/state/readModels.types";

export interface RoomDetailHeader {
  readonly structureName: string;
  readonly roomName: string;
  readonly purposeLabel: string;
  readonly areaUsedLabel: string;
  readonly areaFreeLabel: string;
  readonly volumeUsedLabel: string;
  readonly volumeFreeLabel: string;
  readonly achCurrent: number;
  readonly achTarget: number;
}

export interface RoomZoneListItem {
  readonly id: string;
  readonly name: string;
  readonly link: string;
  readonly healthPercent: number;
  readonly qualityPercent: number;
  readonly readyToHarvest: boolean;
  readonly pestBadges: readonly string[];
  readonly deviceWarnings: readonly string[];
}

export interface RoomClimateMetric {
  readonly id: string;
  readonly label: string;
  readonly measuredLabel: string;
  readonly targetLabel: string;
  readonly status: "ok" | "warn";
  readonly statusLabel: string;
}

export interface RoomClimateOverview {
  readonly notes: string | null;
  readonly metrics: readonly RoomClimateMetric[];
}

export interface RoomDeviceAction {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  readonly disabledReason: string;
}

export interface RoomDeviceListItem {
  readonly id: string;
  readonly name: string;
  readonly conditionLabel: string;
  readonly contributionLabel: string;
  readonly eligibilityLabel: string;
  readonly warnings: readonly string[];
  readonly actions: readonly RoomDeviceAction[];
}

export interface RoomDeviceGroup {
  readonly id: string;
  readonly title: string;
  readonly devices: readonly RoomDeviceListItem[];
}

export interface RoomTimelineItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly statusLabel: string;
  readonly timestampLabel: string;
}

export interface RoomAction {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  readonly disabledReason: string;
}

export interface RoomLightingControlSnapshot {
  readonly title: string;
  readonly description: string | null;
  readonly measuredPpfd: number;
  readonly targetPpfd: number;
  readonly deviation: ControlCardDeviationThresholds;
  readonly schedule: LightScheduleInput;
  readonly onTargetChange: (nextValue: number) => void;
  readonly onScheduleSubmit: (schedule: LightScheduleInput) => void;
  readonly isScheduleSubmitting: boolean;
  readonly deviceTiles: readonly LightingDeviceTileProps[];
  readonly ghostPlaceholders: readonly ControlCardGhostPlaceholderDefinition[];
  readonly deviceSectionEmptyLabel: string;
  readonly scheduleSubmitLabel: string;
}

export interface RoomClimateControlSnapshot {
  readonly title: string;
  readonly description: string | null;
  readonly temperature: ClimateControlMetricDefinition;
  readonly humidity: ClimateControlMetricDefinition;
  readonly co2: ClimateControlMetricDefinition;
  readonly ach: ClimateControlMetricDefinition;
  readonly deviceClasses: readonly ClimateControlDeviceClassSection[];
  readonly ghostPlaceholders: readonly ControlCardGhostPlaceholderDefinition[];
  readonly deviceSectionEmptyLabel: string;
}

export interface RoomControlCardsSnapshot {
  readonly lighting: RoomLightingControlSnapshot;
  readonly climate: RoomClimateControlSnapshot;
}

export interface RoomDetailSnapshot {
  readonly header: RoomDetailHeader;
  readonly zones: readonly RoomZoneListItem[];
  readonly climate: RoomClimateOverview;
  readonly deviceGroups: readonly RoomDeviceGroup[];
  readonly timeline: readonly RoomTimelineItem[];
  readonly actions: readonly RoomAction[];
  readonly controls: RoomControlCardsSnapshot;
}

const READY_HEALTH_THRESHOLD_PERCENT = 85;
const READY_QUALITY_THRESHOLD_PERCENT = 85;
const ACH_STATUS_TOLERANCE_ACH = 0.4;
const CLIMATE_STATUS_WITHIN_RANGE = "Within range" as const;
const CLIMATE_STATUS_NEEDS_ATTENTION = "Needs attention" as const;
const CLIMATE_STATUS_PENDING = "Telemetry pending" as const;
const ROOM_DEFAULT_LIGHT_SCHEDULE: LightScheduleInput = Object.freeze({ onHours: 18, offHours: 6, startHour: 0 });
const ROOM_LIGHTING_WARNING_DELTA_PPFD = 50;
const ROOM_LIGHTING_CRITICAL_DELTA_PPFD = 150;
const ROOM_LIGHTING_DEVIATION: ControlCardDeviationThresholds = Object.freeze({
  warningDelta: ROOM_LIGHTING_WARNING_DELTA_PPFD,
  criticalDelta: ROOM_LIGHTING_CRITICAL_DELTA_PPFD
});
const ROOM_CLIMATE_DEVIATION: ControlCardDeviationThresholds = Object.freeze({
  warningDelta: 1,
  criticalDelta: 2
});
const ROOM_HUMIDITY_WARNING_DELTA_PERCENT = 5;
const ROOM_HUMIDITY_CRITICAL_DELTA_PERCENT = 10;
const ROOM_CO2_WARNING_DELTA_PPM = 120;
const ROOM_CO2_CRITICAL_DELTA_PPM = 240;
const REQUIRED_ROOM_LIGHTING_CLASSES = Object.freeze(["lighting"] as const);

export function useRoomDetailView(structureId: string, roomId: string): RoomDetailSnapshot {
  const structure = useStructureReadModel(structureId);
  const room = useRoomReadModel(structureId, roomId);
  const zoneSnapshots = useTelemetryStore((state) => state.zoneSnapshots);
  const primaryZoneId = room?.zones[0]?.id ?? null;
  const zoneLightSchedule = useZoneLightSchedule(primaryZoneId);

  return useMemo(() => {
    if (!room) {
      return DEFAULT_SNAPSHOT;
    }

    const header = toRoomHeader(structure?.name ?? "Structure", room);
    const zones = room.zones.map((zone) => toZoneListItem(structureId, zone));
    const climate = toClimateOverview(room);
    const deviceGroups = groupDevicesByClass(room);
    const timeline = room.timeline.map(toTimelineItem);
    const actions = createRoomActions(structureId, room.id);
    const controls = buildRoomControlCards(
      structure,
      room,
      zoneSnapshots,
      zoneLightSchedule,
      primaryZoneId
    );

    return {
      header,
      zones,
      climate,
      deviceGroups,
      timeline,
      actions,
      controls
    } satisfies RoomDetailSnapshot;
  }, [
    room,
    structure?.name,
    structure,
    structureId,
    zoneSnapshots,
    zoneLightSchedule,
    primaryZoneId
  ]);
}

interface RoomClimateBaseline {
  readonly temperature_C: number;
  readonly relativeHumidity_percent: number;
  readonly co2_ppm: number;
}

/* eslint-disable @typescript-eslint/no-magic-numbers */
const ROOM_CLIMATE_BASELINES: Record<string, RoomClimateBaseline> = Object.freeze({
  growroom: Object.freeze({ temperature_C: 24, relativeHumidity_percent: 60, co2_ppm: 900 }),
  storageroom: Object.freeze({ temperature_C: 18, relativeHumidity_percent: 50, co2_ppm: 450 }),
  laboratory: Object.freeze({ temperature_C: 21, relativeHumidity_percent: 45, co2_ppm: 420 }),
  breakroom: Object.freeze({ temperature_C: 21, relativeHumidity_percent: 40, co2_ppm: 420 }),
  salesroom: Object.freeze({ temperature_C: 20, relativeHumidity_percent: 45, co2_ppm: 420 }),
  workshop: Object.freeze({ temperature_C: 19, relativeHumidity_percent: 45, co2_ppm: 420 })
});

const FALLBACK_BASELINE: RoomClimateBaseline = Object.freeze({
  temperature_C: 22,
  relativeHumidity_percent: 55,
  co2_ppm: 500
});

const TEMPERATURE_TOLERANCE_C = 1.2;
const RH_TOLERANCE_PERCENT = 5;
const CO2_TOLERANCE_PPM = 120;
/* eslint-enable @typescript-eslint/no-magic-numbers */

const formatterWhole = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0
});

const formatterOneDecimal = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
});

function formatArea(value: number): string {
  return `${formatterWhole.format(Math.round(value))} m²`;
}

function formatVolume(value: number): string {
  return `${formatterWhole.format(Math.round(value))} m³`;
}

function toRoomHeader(structureName: string, room: RoomReadModel): RoomDetailHeader {
  return {
    structureName,
    roomName: room.name,
    purposeLabel: room.purpose,
    areaUsedLabel: formatArea(room.capacity.areaUsed_m2),
    areaFreeLabel: formatArea(room.capacity.areaFree_m2),
    volumeUsedLabel: formatVolume(room.capacity.volumeUsed_m3),
    volumeFreeLabel: formatVolume(room.capacity.volumeFree_m3),
    achCurrent: room.coverage.achCurrent,
    achTarget: room.coverage.achTarget
  } satisfies RoomDetailHeader;
}

function toZoneListItem(structureId: string, zone: ZoneReadModel): RoomZoneListItem {
  const pestBadges: string[] = [];

  if (zone.pestStatus.activeIssues > 0) {
    pestBadges.push(`Active issues: ${formatterWhole.format(zone.pestStatus.activeIssues)}`);
  }

  if (zone.pestStatus.dueInspections > 0) {
    pestBadges.push(`Inspections due: ${formatterWhole.format(zone.pestStatus.dueInspections)}`);
  }

  if (zone.pestStatus.upcomingTreatments > 0) {
    pestBadges.push(`Treatments scheduled: ${formatterWhole.format(zone.pestStatus.upcomingTreatments)}`);
  }

  const deviceWarnings = zone.coverageWarnings.map((warning) => warning.message);
  const readyToHarvest = computeReadyToHarvest(zone);

  return {
    id: zone.id,
    name: zone.name,
    link: buildZonePath(structureId, zone.id),
    healthPercent: zone.kpis.healthPercent,
    qualityPercent: zone.kpis.qualityPercent,
    readyToHarvest,
    pestBadges,
    deviceWarnings
  } satisfies RoomZoneListItem;
}

function computeReadyToHarvest(zone: ZoneReadModel): boolean {
  return (
    zone.kpis.healthPercent >= READY_HEALTH_THRESHOLD_PERCENT &&
    zone.kpis.qualityPercent >= READY_QUALITY_THRESHOLD_PERCENT &&
    zone.pestStatus.upcomingTreatments === 0 &&
    zone.pestStatus.activeIssues === 0
  );
}

function toClimateOverview(room: RoomReadModel): RoomClimateOverview {
  const baseline = ROOM_CLIMATE_BASELINES[room.purpose] ?? FALLBACK_BASELINE;
  const notes = room.climateSnapshot.notes;

  const metrics: RoomClimateMetric[] = [
    {
      id: "temperature",
      label: "Air temperature",
      measuredLabel: `${formatterOneDecimal.format(room.climateSnapshot.temperature_C)} °C`,
      targetLabel: `Target ${formatterWhole.format(Math.round(baseline.temperature_C))} °C`,
      ...resolveStatus(room.climateSnapshot.temperature_C, baseline.temperature_C, TEMPERATURE_TOLERANCE_C)
    },
    {
      id: "relative-humidity",
      label: "Relative humidity",
      measuredLabel: `${formatterWhole.format(Math.round(room.climateSnapshot.relativeHumidity_percent))}%`,
      targetLabel: `Target ${formatterWhole.format(Math.round(baseline.relativeHumidity_percent))}%`,
      ...resolveStatus(
        room.climateSnapshot.relativeHumidity_percent,
        baseline.relativeHumidity_percent,
        RH_TOLERANCE_PERCENT
      )
    },
    {
      id: "co2",
      label: "CO₂ concentration",
      measuredLabel: `${formatterWhole.format(Math.round(room.climateSnapshot.co2_ppm))} ppm`,
      targetLabel: `Target ${formatterWhole.format(Math.round(baseline.co2_ppm))} ppm`,
      ...resolveStatus(room.climateSnapshot.co2_ppm, baseline.co2_ppm, CO2_TOLERANCE_PPM)
    },
    {
      id: "ach",
      label: "Air changes per hour",
      measuredLabel: `${formatterOneDecimal.format(room.coverage.achCurrent)} ACH`,
      targetLabel: `Target ${formatterOneDecimal.format(room.coverage.achTarget)} ACH`,
      ...resolveStatus(room.coverage.achCurrent, room.coverage.achTarget, ACH_STATUS_TOLERANCE_ACH)
    }
  ];

  return {
    notes,
    metrics
  } satisfies RoomClimateOverview;
}

function resolveStatus(
  measured: number,
  target: number,
  tolerance: number
): { status: "ok" | "warn"; statusLabel: string } {
  if (!Number.isFinite(measured) || !Number.isFinite(target)) {
    return { status: "warn", statusLabel: CLIMATE_STATUS_PENDING };
  }

  const difference = Math.abs(measured - target);
  const withinRange = difference <= tolerance;

  return withinRange
    ? { status: "ok", statusLabel: CLIMATE_STATUS_WITHIN_RANGE }
    : { status: "warn", statusLabel: CLIMATE_STATUS_NEEDS_ATTENTION };
}

function groupDevicesByClass(room: RoomReadModel): RoomDeviceGroup[] {
  const grouped = new Map<string, RoomDeviceListItem[]>();

  room.devices.forEach((device) => {
    const existing = grouped.get(device.class) ?? [];
    existing.push(toDeviceListItem(room, device));
    grouped.set(device.class, existing);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([deviceClass, devices]) => ({
      id: deviceClass,
      title: formatDeviceClass(deviceClass),
      devices: devices.sort((a, b) => a.name.localeCompare(b.name))
    } satisfies RoomDeviceGroup));
}

function toDeviceListItem(room: RoomReadModel, device: DeviceSummary): RoomDeviceListItem {
  const eligibilityLabel = `Eligible for ${room.purpose}`;
  const warnings = device.warnings.map((warning) => warning.message);
  const actions = createDeviceActions(room.structureId, room.id, device.id);

  return {
    id: device.id,
    name: device.name,
    conditionLabel: `${formatterWhole.format(Math.round(device.conditionPercent))}% condition`,
    contributionLabel: resolveContributionLabel(device),
    eligibilityLabel,
    warnings,
    actions
  } satisfies RoomDeviceListItem;
}

function resolveContributionLabel(device: DeviceSummary): string {
  if (device.airflow_m3_per_hour > 0) {
    return `${formatterWhole.format(Math.round(device.airflow_m3_per_hour))} m³/h airflow`;
  }

  if (device.coverageArea_m2 > 0) {
    return `${formatterWhole.format(Math.round(device.coverageArea_m2))} m² coverage`;
  }

  if (device.powerDraw_kWh_per_hour > 0) {
    return `${formatterOneDecimal.format(device.powerDraw_kWh_per_hour)} kWh/hour draw`;
  }

  return "Contribution pending telemetry";
}

const TIMELINE_STATUS_LABEL: Record<TimelineEntry["status"], string> = {
  scheduled: "Scheduled",
  "in-progress": "In progress",
  completed: "Completed",
  blocked: "Blocked"
};

function toTimelineItem(entry: TimelineEntry): RoomTimelineItem {
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    statusLabel: TIMELINE_STATUS_LABEL[entry.status],
    timestampLabel: `Tick ${formatterWhole.format(entry.timestamp)}`
  } satisfies RoomTimelineItem;
}

function createRoomActions(structureId: string, roomId: string): RoomAction[] {
  return [
    {
      id: "room-action-create-zone",
      label: "Create zone",
      onSelect: () => {
        console.info("[stub] create zone", { structureId, roomId });
      },
      disabledReason: "Zone creation wiring lands with Task 7000."
    },
    {
      id: "room-action-duplicate-zone",
      label: "Duplicate zone",
      onSelect: () => {
        console.info("[stub] duplicate zone", { structureId, roomId });
      },
      disabledReason: "Zone duplication orchestration lands with Task 7000."
    },
    {
      id: "room-action-set-baselines",
      label: "Set climate baselines",
      onSelect: () => {
        console.info("[stub] set climate baseline", { structureId, roomId });
      },
      disabledReason: "Baseline editor arrives with Task 7100."
    },
    {
      id: "room-action-move-zone",
      label: "Move zone",
      onSelect: () => {
        console.info("[stub] move zone", { structureId, roomId });
      },
      disabledReason: "Zone move orchestration lands with Task 8000."
    },
    {
      id: "room-action-move-device",
      label: "Move devices",
      onSelect: () => {
        console.info("[stub] move devices", { structureId, roomId });
      },
      disabledReason: "Device move flow ships with Task 8000."
    }
  ];
}

function buildRoomControlCards(
  structure: StructureReadModel | null,
  room: RoomReadModel,
  zoneSnapshots: Map<string, TelemetryZoneSnapshotPayload>,
  schedule: LightScheduleInput,
  primaryZoneId: string | null
): RoomControlCardsSnapshot {
  const normalizedSchedule = normalizeLightSchedule(schedule);
  const lighting = buildRoomLightingControl(room, zoneSnapshots, normalizedSchedule, primaryZoneId);
  const climate = buildRoomClimateControl(structure, room);
  return { lighting, climate } satisfies RoomControlCardsSnapshot;
}

function buildRoomLightingControl(
  room: RoomReadModel,
  zoneSnapshots: Map<string, TelemetryZoneSnapshotPayload>,
  schedule: LightScheduleInput,
  primaryZoneId: string | null
): RoomLightingControlSnapshot {
  const targetPpfd = computeRoomTargetPpfd(room);
  const measuredPpfd = computeRoomMeasuredPpfd(room, zoneSnapshots, targetPpfd);
  const deviceTiles = createRoomLightingTiles(room);
  const ghostPlaceholders = deviceTiles.length > 0
    ? ([] as ControlCardGhostPlaceholderDefinition[])
    : REQUIRED_ROOM_LIGHTING_CLASSES.map((classId) => ({
        deviceClassId: classId,
        label: "Lighting coverage",
        description: "Install lighting fixtures across zones to maintain PPFD baselines.",
        actionLabel: CAPACITY_ADVISOR_ACTION_LABEL
      } satisfies ControlCardGhostPlaceholderDefinition));

  return {
    title: "Lighting controls",
    description:
      room.zones.length > 0
        ? `Average PPFD target derived from ${String(room.zones.length)} zone stage baselines.`
        : "Room PPFD target derived from cultivation stage heuristics.",
    measuredPpfd,
    targetPpfd,
    deviation: ROOM_LIGHTING_DEVIATION,
    schedule,
    onTargetChange: (nextValue: number) => {
      console.info("[stub] set room lighting target", { roomId: room.id, targetPPFD: nextValue });
    },
    onScheduleSubmit: (nextSchedule: LightScheduleInput) => {
      if (primaryZoneId) {
        recordZoneLightSchedule(primaryZoneId, nextSchedule);
      }
      console.info("[stub] set room lighting schedule", { roomId: room.id, zoneId: primaryZoneId });
    },
    isScheduleSubmitting: false,
    deviceTiles,
    ghostPlaceholders,
    deviceSectionEmptyLabel: "No lighting devices configured for this room.",
    scheduleSubmitLabel: "Save schedule"
  } satisfies RoomLightingControlSnapshot;
}

function buildRoomClimateControl(
  structure: StructureReadModel | null,
  room: RoomReadModel
): RoomClimateControlSnapshot {
  const baseline = ROOM_CLIMATE_BASELINES[room.purpose] ?? FALLBACK_BASELINE;
  const temperature = createRoomClimateMetric(
    "temperature",
    "Temperature",
    room.climateSnapshot.temperature_C,
    baseline.temperature_C,
    ROOM_CLIMATE_DEVIATION,
    "±1.0 °C tolerance"
  );
  const humidity = createRoomClimateMetric(
    "humidity",
    "Relative humidity",
    room.climateSnapshot.relativeHumidity_percent,
    baseline.relativeHumidity_percent,
    {
      warningDelta: ROOM_HUMIDITY_WARNING_DELTA_PERCENT,
      criticalDelta: ROOM_HUMIDITY_CRITICAL_DELTA_PERCENT
    },
    "±5% tolerance"
  );
  const co2 = createRoomClimateMetric(
    "co2",
    "CO₂",
    room.climateSnapshot.co2_ppm,
    baseline.co2_ppm,
    { warningDelta: ROOM_CO2_WARNING_DELTA_PPM, criticalDelta: ROOM_CO2_CRITICAL_DELTA_PPM },
    "±120 ppm tolerance"
  );
  const ach = createRoomClimateMetric(
    "ach",
    "Air changes per hour",
    room.climateSnapshot.ach,
    room.coverage.achTarget,
    ROOM_CLIMATE_DEVIATION,
    "±0.4 ACH tolerance"
  );

  const deviceClasses = createRoomClimateDeviceSections(structure, room);
  const presentClassIds = new Set(deviceClasses.map((section) => section.classId));
  const ghostPlaceholders = REQUIRED_CLIMATE_CLASSES.filter((classId) => !presentClassIds.has(classId)).map(
    (classId) => ({
      deviceClassId: classId,
      label: formatDeviceClass(classId),
      description: `Add ${formatDeviceClass(classId).toLowerCase()} devices to maintain room baselines.`,
      actionLabel: CAPACITY_ADVISOR_ACTION_LABEL
    })
  );

  return {
    title: "Climate controls",
    description: "Room-level telemetry compared against SEC-aligned baselines.",
    temperature,
    humidity,
    co2,
    ach,
    deviceClasses,
    ghostPlaceholders,
    deviceSectionEmptyLabel: "No climate devices configured for this room."
  } satisfies RoomClimateControlSnapshot;
}

function createRoomClimateMetric(
  metricId: string,
  label: string,
  measured: number,
  target: number,
  thresholds: ControlCardDeviationThresholds,
  toleranceLabel: string
): ClimateControlMetricDefinition {
  return {
    label,
    measured: createRoomMetricValue(metricId, "Measured", measured),
    target: createRoomMetricValue(metricId, "Target", target),
    deviation: thresholds,
    toleranceLabel
  } satisfies ClimateControlMetricDefinition;
}

function createRoomMetricValue(metricId: string, label: string, value: number): ControlCardMetricValue {
  return {
    label,
    displayValue: formatRoomClimateValue(metricId, value),
    numericValue: value
  } satisfies ControlCardMetricValue;
}

function formatRoomClimateValue(metricId: string, value: number): string {
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
    case "ach":
      return `${formatterOneDecimal.format(value)} ACH`;
    default:
      return formatterOneDecimal.format(value);
  }
}

function createRoomClimateDeviceSections(
  structure: StructureReadModel | null,
  room: RoomReadModel
): ClimateControlDeviceClassSection[] {
  const relevantClasses = new Set<string>(RELEVANT_CLIMATE_CLASSES);
  const grouped = new Map<string, ClimateControlDeviceTileProps[]>();
  const candidates: DeviceSummary[] = [
    ...room.devices,
    ...(structure?.devices ?? [])
  ];

  for (const device of candidates) {
    if (!relevantClasses.has(device.class)) {
      continue;
    }

    const existing = grouped.get(device.class) ?? [];
    const tile = createRoomClimateDeviceTile(room, device);
    if (!existing.some((candidate) => candidate.id === tile.id)) {
      existing.push(tile);
    }
    grouped.set(device.class, existing);
  }

  return Array.from(grouped.entries())
    .map(([classId, devices]) => ({
      classId,
      label: formatDeviceClass(classId),
      devices: devices.sort((left, right) => left.name.localeCompare(right.name))
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function createRoomClimateDeviceTile(room: RoomReadModel, device: DeviceSummary): ClimateControlDeviceTileProps {
  const throughputFraction01 = device.airflow_m3_per_hour > 0
    ? clampRoom01(device.airflow_m3_per_hour / Math.max(room.volume_m3, 1))
    : 0;
  const capacityFraction01 = device.coverageArea_m2 > 0
    ? clampRoom01(device.coverageArea_m2 / Math.max(room.area_m2, 1))
    : throughputFraction01;

  return {
    id: device.id,
    name: device.name,
    throughputFraction01,
    capacityFraction01,
    isEnabled: true,
    onToggleEnabled: (nextEnabled: boolean) => {
      console.info("[stub] toggle room climate device", {
        roomId: room.id,
        deviceId: device.id,
        nextEnabled
      });
    },
    onMove: () => {
      console.info("[stub] move room climate device", { roomId: room.id, deviceId: device.id });
    },
    onRemove: () => {
      console.info("[stub] remove room climate device", { roomId: room.id, deviceId: device.id });
    },
    description: buildRoomClimateDeviceDescription(device)
  } satisfies ClimateControlDeviceTileProps;
}

function buildRoomClimateDeviceDescription(device: DeviceSummary): string | undefined {
  if (device.airflow_m3_per_hour > 0) {
    return `${formatterWhole.format(Math.round(device.airflow_m3_per_hour))} m³/h airflow`;
  }
  if (device.coverageArea_m2 > 0) {
    return `${formatterWhole.format(Math.round(device.coverageArea_m2))} m² coverage`;
  }
  if (device.powerDraw_kWh_per_hour > 0) {
    return `${formatterOneDecimal.format(device.powerDraw_kWh_per_hour)} kWh/hour draw`;
  }
  return undefined;
}

function clampRoom01(value: number): number {
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

function computeRoomTargetPpfd(room: RoomReadModel): number {
  if (room.zones.length === 0) {
    return selectRoomLightingFallbackTarget(room);
  }

  const total = room.zones.reduce((sum, zone) => sum + selectStageLightingTarget(zone, room), 0);
  return total / room.zones.length;
}

function computeRoomMeasuredPpfd(
  room: RoomReadModel,
  zoneSnapshots: Map<string, TelemetryZoneSnapshotPayload>,
  fallback: number
): number {
  let total = 0;
  let count = 0;
  for (const zone of room.zones) {
    const snapshot = zoneSnapshots.get(zone.id);
    if (snapshot && Number.isFinite(snapshot.ppfd)) {
      total += snapshot.ppfd;
      count += 1;
    }
  }
  if (count === 0) {
    return fallback;
  }
  return total / count;
}

function createRoomLightingTiles(room: RoomReadModel): LightingDeviceTileProps[] {
  const lightingDevices = room.devices.filter((device) => device.class === "lighting");
  const totalCoverage = lightingDevices.reduce((sum, device) => sum + Math.max(0, device.coverageArea_m2), 0);
  const totalPower = lightingDevices.reduce((sum, device) => sum + Math.max(0, device.powerDraw_kWh_per_hour), 0);

  return lightingDevices.map((device) => {
    const coverageFraction = totalCoverage > 0 ? clampRoom01(device.coverageArea_m2 / totalCoverage) : 0;
    const powerFraction = totalPower > 0 ? clampRoom01(device.powerDraw_kWh_per_hour / totalPower) : 0;
    const contributionFraction01 = coverageFraction > 0 ? coverageFraction : powerFraction;

    return {
      id: device.id,
      name: device.name,
      contributionFraction01,
      isEnabled: true,
      onToggle: (nextEnabled: boolean) => {
        console.info("[stub] toggle room lighting device", {
          roomId: room.id,
          deviceId: device.id,
          nextEnabled
        });
      },
      description: buildRoomLightingDescription(device)
    } satisfies LightingDeviceTileProps;
  });
}

function buildRoomLightingDescription(device: DeviceSummary): string | undefined {
  if (device.coverageArea_m2 > 0) {
    return `${formatterWhole.format(Math.round(device.coverageArea_m2))} m² coverage`;
  }
  if (device.powerDraw_kWh_per_hour > 0) {
    return `${formatterOneDecimal.format(device.powerDraw_kWh_per_hour)} kWh/hour draw`;
  }
  return undefined;
}

function createDeviceActions(structureId: string, roomId: string, deviceId: string): RoomDeviceAction[] {
  return [
    {
      id: "device-action-move",
      label: "Move device",
      onSelect: () => {
        console.info("[stub] move device", { structureId, roomId, deviceId });
      },
      disabledReason: "Device move orchestration lands with Task 8000."
    },
    {
      id: "device-action-remove",
      label: "Remove device",
      onSelect: () => {
        console.info("[stub] remove device", { structureId, roomId, deviceId });
      },
      disabledReason: "Device removal UI ships with Task 8001."
    },
    {
      id: "device-action-replace",
      label: "Replace device",
      onSelect: () => {
        console.info("[stub] replace device", { structureId, roomId, deviceId });
      },
      disabledReason: "Device replacement planner lands with Task 8002."
    }
  ];
}

function formatDeviceClass(deviceClass: string): string {
  return deviceClass
    .split(/[.-]/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

const DEFAULT_SNAPSHOT: RoomDetailSnapshot = Object.freeze({
  header: Object.freeze({
    structureName: "Structure",
    roomName: "Room",
    purposeLabel: "purpose",
    areaUsedLabel: "0 m²",
    areaFreeLabel: "0 m²",
    volumeUsedLabel: "0 m³",
    volumeFreeLabel: "0 m³",
    achCurrent: 0,
    achTarget: 0
  }),
  zones: Object.freeze([]),
  climate: Object.freeze({
    notes: null,
    metrics: Object.freeze([])
  }),
  deviceGroups: Object.freeze([]),
  timeline: Object.freeze([]),
  actions: Object.freeze([]),
  controls: Object.freeze({
    lighting: Object.freeze({
      title: "Lighting controls",
      description: null,
      measuredPpfd: 0,
      targetPpfd: 0,
      deviation: ROOM_LIGHTING_DEVIATION,
      schedule: ROOM_DEFAULT_LIGHT_SCHEDULE,
      onTargetChange: (nextValue: number) => {
        void nextValue;
      },
      onScheduleSubmit: (schedule: LightScheduleInput) => {
        void schedule;
      },
      isScheduleSubmitting: false,
      deviceTiles: Object.freeze([]),
      ghostPlaceholders: Object.freeze([]),
      deviceSectionEmptyLabel: "No lighting devices configured.",
      scheduleSubmitLabel: "Save schedule"
    }),
    climate: Object.freeze({
      title: "Climate controls",
      description: null,
      temperature: Object.freeze({
        label: "Temperature",
        measured: Object.freeze({ label: "Measured", displayValue: "—" }),
        target: Object.freeze({ label: "Target", displayValue: "—" }),
        deviation: ROOM_CLIMATE_DEVIATION
      }),
      humidity: Object.freeze({
        label: "Relative humidity",
        measured: Object.freeze({ label: "Measured", displayValue: "—" }),
        target: Object.freeze({ label: "Target", displayValue: "—" }),
        deviation: ROOM_CLIMATE_DEVIATION
      }),
      co2: Object.freeze({
        label: "CO₂",
        measured: Object.freeze({ label: "Measured", displayValue: "—" }),
        target: Object.freeze({ label: "Target", displayValue: "—" }),
        deviation: ROOM_CLIMATE_DEVIATION
      }),
      ach: Object.freeze({
        label: "Air changes per hour",
        measured: Object.freeze({ label: "Measured", displayValue: "—" }),
        target: Object.freeze({ label: "Target", displayValue: "—" }),
        deviation: ROOM_CLIMATE_DEVIATION
      }),
      deviceClasses: Object.freeze([]),
      ghostPlaceholders: Object.freeze([]),
      deviceSectionEmptyLabel: "No climate devices configured."
    })
  })
});

