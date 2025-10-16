import { useMemo } from "react";
import { buildZonePath } from "@ui/lib/navigation";
import { useRoomReadModel, useStructureReadModel } from "@ui/lib/readModelHooks";
import type {
  DeviceSummary,
  RoomReadModel,
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

export interface RoomDetailSnapshot {
  readonly header: RoomDetailHeader;
  readonly zones: readonly RoomZoneListItem[];
  readonly climate: RoomClimateOverview;
  readonly deviceGroups: readonly RoomDeviceGroup[];
  readonly timeline: readonly RoomTimelineItem[];
  readonly actions: readonly RoomAction[];
}

const READY_HEALTH_THRESHOLD_PERCENT = 85;
const READY_QUALITY_THRESHOLD_PERCENT = 85;
const ACH_STATUS_TOLERANCE_ACH = 0.4;
const CLIMATE_STATUS_WITHIN_RANGE = "Within range" as const;
const CLIMATE_STATUS_NEEDS_ATTENTION = "Needs attention" as const;
const CLIMATE_STATUS_PENDING = "Telemetry pending" as const;

export function useRoomDetailView(structureId: string, roomId: string): RoomDetailSnapshot {
  const structure = useStructureReadModel(structureId);
  const room = useRoomReadModel(structureId, roomId);

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

    return {
      header,
      zones,
      climate,
      deviceGroups,
      timeline,
      actions
    } satisfies RoomDetailSnapshot;
  }, [room, structure?.name, structureId]);
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
  actions: Object.freeze([])
});

