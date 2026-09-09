import type { ControlCardDeviationThresholds, ControlCardGhostPlaceholderDefinition, ControlCardMetricValue } from "@ui/components/controls/ControlCard";
import type { ClimateControlDeviceClassSection, ClimateControlDeviceTileProps, ClimateControlMetricDefinition } from "@ui/components/controls/ClimateControlCard";
import type { LightingDeviceTileProps } from "@ui/components/controls/LightingControlCard";
import { normalizeLightSchedule, type LightScheduleInput } from "@ui/lib/lightScheduleValidation";
import { submitIntentOrThrow } from "@ui/lib/intentSubmission";
import type { useIntentClient } from "@ui/transport";
import { recordZoneLightSchedule } from "@ui/state/intents";
import type { TelemetryZoneSnapshotPayload } from "@ui/state/telemetry";
import type { DeviceSummary, RoomReadModel, StructureReadModel, ZoneReadModel } from "@ui/state/readModels.types";
import type { ZoneClimateControlSnapshot, ZoneControlCardsSnapshot, ZoneLightingControlSnapshot } from "./zoneDetailHooks";
import { clamp01, deriveZoneStageLabel, formatAirflow, formatArea, formatDeviceClass, formatMeasuredValue, selectStageBaseline, selectStageLightingTarget } from "./zoneDetailHelpers";

const DEFAULT_LIGHTING_DEVIATION: ControlCardDeviationThresholds = Object.freeze({ warningDelta: 50, criticalDelta: 150 });
const DEFAULT_CLIMATE_DEVIATION: ControlCardDeviationThresholds = Object.freeze({ warningDelta: 1, criticalDelta: 2 });
const REQUIRED_LIGHTING_CLASSES = Object.freeze(["lighting"] as const);
const REQUIRED_CLIMATE_CLASSES = Object.freeze(["climate", "airflow"] as const);
const RELEVANT_CLIMATE_CLASSES = Object.freeze(["climate", "airflow", "co2", "humidifier", "dehumidifier", "heater"] as const);
const CAPACITY_ADVISOR_ACTION_LABEL = "Open Capacity Advisor" as const;
const formatterOneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function buildZoneControlCards(
  structureId: string,
  roomId: string | null,
  structure: StructureReadModel | null,
  room: RoomReadModel | null,
  zone: ZoneReadModel,
  schedule: LightScheduleInput,
  telemetry: TelemetryZoneSnapshotPayload | null,
  intentClient: ReturnType<typeof useIntentClient>
): ZoneControlCardsSnapshot {
  const normalizedSchedule = normalizeLightSchedule(schedule);

  const lighting = buildZoneLightingControl(
    structureId,
    roomId,
    room,
    zone,
    normalizedSchedule,
    telemetry,
    intentClient
  );
  const climate = buildZoneClimateControl(structure, room, zone, telemetry);

  return { lighting, climate } satisfies ZoneControlCardsSnapshot;
}

function buildZoneLightingControl(
  structureId: string,
  roomId: string | null,
  room: RoomReadModel | null,
  zone: ZoneReadModel,
  schedule: LightScheduleInput,
  telemetry: TelemetryZoneSnapshotPayload | null,
  intentClient: ReturnType<typeof useIntentClient>
): ZoneLightingControlSnapshot {
  const targetPpfd = selectStageLightingTarget(zone, room);
  const measuredPpfd = telemetry?.ppfd ?? targetPpfd;
  const deviceTiles = createZoneLightingTiles(zone);
  const ghostPlaceholders = deviceTiles.length > 0
    ? ([] as ControlCardGhostPlaceholderDefinition[])
    : REQUIRED_LIGHTING_CLASSES.map((classId) => ({
      deviceClassId: classId,
      label: "Lighting coverage",
      description: "Install lighting fixtures to meet canopy PPFD targets.",
      actionLabel: CAPACITY_ADVISOR_ACTION_LABEL
    } satisfies ControlCardGhostPlaceholderDefinition));

  return {
    title: "Lighting controls",
    description: `Target PPFD baseline derived from ${deriveZoneStageLabel(zone).toLowerCase()} stage assumptions.`,
    measuredPpfd,
    targetPpfd,
    deviation: DEFAULT_LIGHTING_DEVIATION,
    schedule,
    onScheduleSubmit: (nextSchedule: LightScheduleInput) => {
      const normalized = normalizeLightSchedule(nextSchedule);
      recordZoneLightSchedule(zone.id, normalized);
      if (intentClient) {
        void submitIntentOrThrow(intentClient, {
          type: "intent.zone.lighting.adjust.v1",
          structureId,
          zoneId: zone.id,
          lightSchedule: normalized
        });
      }
    },
    isScheduleSubmitting: false,
    deviceTiles,
    ghostPlaceholders,
    deviceSectionEmptyLabel: "No lighting devices configured for this zone.",
    scheduleSubmitLabel: "Save schedule"
  } satisfies ZoneLightingControlSnapshot;
}

function buildZoneClimateControl(
  structure: StructureReadModel | null,
  room: RoomReadModel | null,
  zone: ZoneReadModel,
  telemetry: TelemetryZoneSnapshotPayload | null
): ZoneClimateControlSnapshot {
  const baseline = selectStageBaseline(zone, room);
  const measuredTemperature = telemetry?.temp_c ?? zone.climateSnapshot.temperature_C;
  const measuredHumidity = telemetry
    ? telemetry.relativeHumidity01 * 100
    : zone.climateSnapshot.relativeHumidity_percent;
  const measuredCo2 = telemetry?.co2_ppm ?? zone.climateSnapshot.co2_ppm;
  const measuredAch = telemetry?.ach ?? zone.climateSnapshot.ach_measured;

  const temperature = createClimateMetricDefinition(
    "temperature",
    "Temperature",
    measuredTemperature,
    baseline.temperature_C,
    DEFAULT_CLIMATE_DEVIATION,
    "±1.0 °C tolerance"
  );

  const humidity = createClimateMetricDefinition(
    "humidity",
    "Relative humidity",
    measuredHumidity,
    baseline.relativeHumidity_percent,
    { warningDelta: 5, criticalDelta: 10 },
    "±5% tolerance"
  );

  const co2 = createClimateMetricDefinition(
    "co2",
    "CO₂",
    measuredCo2,
    baseline.co2_ppm,
    { warningDelta: 120, criticalDelta: 240 },
    "±120 ppm tolerance"
  );

  const ach = createClimateMetricDefinition(
    "ach",
    "Air changes per hour",
    measuredAch,
    zone.climateSnapshot.ach_target,
    { warningDelta: 0.4, criticalDelta: 0.8 },
    "±0.4 ACH tolerance"
  );

  const deviceClasses = buildZoneClimateDeviceSections(structure, room, zone);
  const presentClassIds = new Set(deviceClasses.map((section) => section.classId));
  const climateGhosts: ControlCardGhostPlaceholderDefinition[] = [];

  for (const classId of REQUIRED_CLIMATE_CLASSES) {
    if (presentClassIds.has(classId)) {
      continue;
    }
    climateGhosts.push({
      deviceClassId: classId,
      label: formatDeviceClass(classId),
      description: `Add ${formatDeviceClass(classId).toLowerCase()} devices to reach target capacity.`,
      actionLabel: CAPACITY_ADVISOR_ACTION_LABEL
    });
  }

  return {
    title: "Climate controls",
    description: "Compare measured telemetry against SEC-aligned climate baselines.",
    temperature,
    humidity,
    co2,
    ach,
    deviceClasses,
    ghostPlaceholders: climateGhosts,
    deviceSectionEmptyLabel: "No climate devices configured for this zone."
  } satisfies ZoneClimateControlSnapshot;
}

function createClimateMetricDefinition(
  metricId: string,
  label: string,
  measured: number,
  target: number,
  thresholds: ControlCardDeviationThresholds,
  toleranceLabel: string
): ClimateControlMetricDefinition {
  return {
    label,
    measured: createMetricValue(metricId, "Measured", measured),
    target: createMetricValue(metricId, "Target", target),
    deviation: thresholds,
    toleranceLabel
  } satisfies ClimateControlMetricDefinition;
}

function createMetricValue(metricId: string, label: string, value: number): ControlCardMetricValue {
  return {
    label,
    displayValue: formatMeasuredValue(metricId, value),
    numericValue: value
  } satisfies ControlCardMetricValue;
}

function createZoneLightingTiles(zone: ZoneReadModel): LightingDeviceTileProps[] {
  const lightingDevices = zone.devices.filter((device) => device.class === "lighting");
  const totalCoverage = lightingDevices.reduce(
    (sum, device) => sum + Math.max(0, device.coverageArea_m2),
    0
  );
  const totalPower = lightingDevices.reduce(
    (sum, device) => sum + Math.max(0, device.powerDraw_kWh_per_hour),
    0
  );

  return lightingDevices.map((device) => {
    const coverageFraction = totalCoverage > 0 ? clamp01(device.coverageArea_m2 / totalCoverage) : 0;
    const powerFraction = totalPower > 0 ? clamp01(device.powerDraw_kWh_per_hour / totalPower) : 0;
    const contributionFraction01 = coverageFraction > 0 ? coverageFraction : powerFraction;

    return {
      id: device.id,
      name: device.name,
      contributionFraction01,
      isEnabled: true,
      description: buildLightingDeviceDescription(device)
    } satisfies LightingDeviceTileProps;
  });
}

function buildLightingDeviceDescription(device: DeviceSummary): string | undefined {
  if (device.coverageArea_m2 > 0) {
    return `${formatArea(device.coverageArea_m2)} coverage`;
  }
  if (device.powerDraw_kWh_per_hour > 0) {
    return `${formatterOneDecimal.format(device.powerDraw_kWh_per_hour)} kWh/hour draw`;
  }
  return undefined;
}

function buildZoneClimateDeviceSections(
  structure: StructureReadModel | null,
  room: RoomReadModel | null,
  zone: ZoneReadModel
): ClimateControlDeviceClassSection[] {
  const relevantClasses = new Set<string>(RELEVANT_CLIMATE_CLASSES);
  const grouped = new Map<string, ClimateControlDeviceTileProps[]>();

  const candidates: DeviceSummary[] = [
    ...zone.devices,
    ...(room?.devices ?? []),
    ...(structure?.devices ?? [])
  ];

  for (const device of candidates) {
    if (!relevantClasses.has(device.class)) {
      continue;
    }

    const existing = grouped.get(device.class) ?? [];
    const tile = createClimateDeviceTile(zone, device);
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

function createClimateDeviceTile(zone: ZoneReadModel, device: DeviceSummary): ClimateControlDeviceTileProps {
  const throughput = device.airflow_m3_per_hour > 0
    ? clamp01(device.airflow_m3_per_hour / Math.max(zone.volume_m3, 1))
    : 0;
  const capacity = device.coverageArea_m2 > 0
    ? clamp01(device.coverageArea_m2 / Math.max(zone.area_m2, 1))
    : throughput;

  return {
    id: device.id,
    name: device.name,
    throughputFraction01: throughput,
    capacityFraction01: capacity,
    isEnabled: true,
    description: buildClimateDeviceDescription(device)
  } satisfies ClimateControlDeviceTileProps;
}

function buildClimateDeviceDescription(device: DeviceSummary): string | undefined {
  if (device.airflow_m3_per_hour > 0) {
    return `${formatAirflow(device.airflow_m3_per_hour)} airflow`;
  }
  if (device.coverageArea_m2 > 0) {
    return `${formatArea(device.coverageArea_m2)} coverage`;
  }
  if (device.powerDraw_kWh_per_hour > 0) {
    return `${formatterOneDecimal.format(device.powerDraw_kWh_per_hour)} kWh/hour draw`;
  }
  return undefined;
}
