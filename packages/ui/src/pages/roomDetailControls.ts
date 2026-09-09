import type { ControlCardDeviationThresholds, ControlCardGhostPlaceholderDefinition, ControlCardMetricValue } from "@ui/components/controls/ControlCard";
import type { ClimateControlDeviceClassSection, ClimateControlDeviceTileProps, ClimateControlMetricDefinition } from "@ui/components/controls/ClimateControlCard";
import type { LightingDeviceTileProps } from "@ui/components/controls/LightingControlCard";
import { normalizeLightSchedule, type LightScheduleInput } from "@ui/lib/lightScheduleValidation";
import { submitIntentOrThrow } from "@ui/lib/intentSubmission";
import { recordZoneLightSchedule } from "@ui/state/intents";
import type { TelemetryZoneSnapshotPayload } from "@ui/state/telemetry";
import type { DeviceSummary, RoomReadModel, StructureReadModel } from "@ui/state/readModels.types";
import type { useIntentClient } from "@ui/transport";
import { CAPACITY_ADVISOR_ACTION_LABEL, selectStageLightingTarget, selectRoomLightingFallbackTarget, RELEVANT_CLIMATE_CLASSES, REQUIRED_CLIMATE_CLASSES } from "./zoneDetailHooks";
import type { RoomControlCardsSnapshot, RoomClimateControlSnapshot, RoomLightingControlSnapshot } from "./roomDetailHooks";

const ROOM_LIGHTING_DEVIATION: ControlCardDeviationThresholds = Object.freeze({ warningDelta: 50, criticalDelta: 150 });
const ROOM_CLIMATE_DEVIATION: ControlCardDeviationThresholds = Object.freeze({ warningDelta: 1, criticalDelta: 2 });
const ROOM_HUMIDITY_WARNING_DELTA_PERCENT = 5;
const ROOM_HUMIDITY_CRITICAL_DELTA_PERCENT = 10;
const ROOM_CO2_WARNING_DELTA_PPM = 120;
const ROOM_CO2_CRITICAL_DELTA_PPM = 240;
const REQUIRED_ROOM_LIGHTING_CLASSES = Object.freeze(["lighting"] as const);
interface RoomClimateBaseline { readonly temperature_C: number; readonly relativeHumidity_percent: number; readonly co2_ppm: number; }
const ROOM_CLIMATE_BASELINES: Record<string, RoomClimateBaseline> = Object.freeze({
  growroom: Object.freeze({ temperature_C: 24, relativeHumidity_percent: 60, co2_ppm: 900 }),
  storageroom: Object.freeze({ temperature_C: 18, relativeHumidity_percent: 50, co2_ppm: 450 }),
  laboratory: Object.freeze({ temperature_C: 21, relativeHumidity_percent: 45, co2_ppm: 420 }),
  breakroom: Object.freeze({ temperature_C: 21, relativeHumidity_percent: 40, co2_ppm: 420 }),
  salesroom: Object.freeze({ temperature_C: 20, relativeHumidity_percent: 45, co2_ppm: 420 }),
  workshop: Object.freeze({ temperature_C: 19, relativeHumidity_percent: 45, co2_ppm: 420 })
});
const FALLBACK_BASELINE: RoomClimateBaseline = Object.freeze({ temperature_C: 22, relativeHumidity_percent: 55, co2_ppm: 500 });
const formatterWhole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
const formatterOneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function buildRoomControlCards(
  structure: StructureReadModel | null,
  room: RoomReadModel,
  zoneSnapshots: Map<string, TelemetryZoneSnapshotPayload>,
  schedule: LightScheduleInput,
  primaryZoneId: string | null,
  intentClient: ReturnType<typeof useIntentClient>
): RoomControlCardsSnapshot {
  const normalizedSchedule = normalizeLightSchedule(schedule);
  const lighting = buildRoomLightingControl(room, zoneSnapshots, normalizedSchedule, primaryZoneId, intentClient);
  const climate = buildRoomClimateControl(structure, room);
  return { lighting, climate } satisfies RoomControlCardsSnapshot;
}

function buildRoomLightingControl(
  room: RoomReadModel,
  zoneSnapshots: Map<string, TelemetryZoneSnapshotPayload>,
  schedule: LightScheduleInput,
  primaryZoneId: string | null,
  intentClient: ReturnType<typeof useIntentClient>
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
    onScheduleSubmit: (nextSchedule: LightScheduleInput) => {
      if (primaryZoneId) {
        recordZoneLightSchedule(primaryZoneId, nextSchedule);
      }

      if (intentClient) {
        // Apply schedule to all zones in the room
        room.zones.forEach((zone) => {
          void submitIntentOrThrow(intentClient, {
            type: "intent.zone.lighting.adjust.v1",
            structureId: room.structureId,
            zoneId: zone.id,
            lightSchedule: normalizeLightSchedule(nextSchedule)
          });
        });
      }
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

function formatDeviceClass(deviceClass: string): string {
  return deviceClass
    .split(/[.-]/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
