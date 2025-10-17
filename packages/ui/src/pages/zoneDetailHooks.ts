import { useMemo } from "react";
import { HOURS_PER_DAY } from "@engine/constants/simConstants.ts";
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
import { normalizeLightSchedule, type LightScheduleInput } from "@ui/lib/lightScheduleValidation";
import { createRng } from "@ui/lib/createRng";
import {
  useRoomReadModel,
  useSimulationReadModel,
  useStructureReadModel,
  useZoneReadModel
} from "@ui/lib/readModelHooks";
import type {
  DeviceSummary,
  RoomReadModel,
  StructureReadModel,
  TimelineEntry,
  ZoneReadModel,
  ZoneTaskEntry
} from "@ui/state/readModels.types";
import { recordZoneLightSchedule, useZoneLightSchedule } from "@ui/state/intents";
import { type TelemetryZoneSnapshotPayload, useZoneSnapshot } from "@ui/state/telemetry";

/* eslint-disable @typescript-eslint/no-magic-numbers */

export interface ZoneBadge {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface ZoneHeaderSnapshot {
  readonly structureName: string;
  readonly zoneName: string;
  readonly cultivarLabel: string;
  readonly stageLabel: string;
  readonly badges: readonly ZoneBadge[];
  readonly hints: readonly string[];
}

export interface ZoneKpiAggregate {
  readonly id: string;
  readonly label: string;
  readonly median: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly unitLabel: string;
  readonly sparkline: readonly number[];
}

export interface ZoneKpiOverview {
  readonly metrics: readonly ZoneKpiAggregate[];
}

export interface ZoneContextSummary {
  readonly areaLabel: string;
  readonly volumeLabel: string;
  readonly plantCapacityLabel: string;
  readonly freePlantLabel: string;
  readonly densityLabel: string;
  readonly roomFreeAreaLabel: string | null;
  readonly roomFreeVolumeLabel: string | null;
}

export interface ZonePestStatusSnapshot {
  readonly counts: {
    readonly activeIssues: number;
    readonly dueInspections: number;
    readonly cooldowns: number;
  };
  readonly lastInspectionLabel: string;
  readonly nextInspectionLabel: string;
  readonly lastTreatmentLabel: string;
  readonly nextTreatmentLabel: string;
  readonly timeline: readonly ZonePestTimelineItem[];
  readonly context: ZoneContextSummary;
}

export interface ZonePestTimelineItem {
  readonly id: string;
  readonly title: string;
  readonly statusLabel: string;
  readonly timestampLabel: string;
}

export interface ZoneClimateMetric {
  readonly id: string;
  readonly label: string;
  readonly measuredLabel: string;
  readonly targetLabel: string;
  readonly status: "ok" | "warn" | "critical";
  readonly statusLabel: string;
}

export interface ZoneClimateSnapshot {
  readonly metrics: readonly ZoneClimateMetric[];
}

export interface ZoneDeviceTile {
  readonly id: string;
  readonly name: string;
  readonly conditionLabel: string;
  readonly contributionLabel: string;
  readonly capLabel: string;
  readonly warnings: readonly string[];
}

export interface ZoneDeviceControl {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  readonly disabledReason: string;
}

export interface ZoneDeviceGroup {
  readonly id: string;
  readonly title: string;
  readonly warnings: readonly string[];
  readonly devices: readonly ZoneDeviceTile[];
  readonly controls: readonly ZoneDeviceControl[];
}

export interface ZoneActionButton {
  readonly id: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly disabledReason: string;
  readonly onSelect: () => void;
}

export interface ZoneDetailSnapshot {
  readonly header: ZoneHeaderSnapshot;
  readonly kpis: ZoneKpiOverview;
  readonly pest: ZonePestStatusSnapshot;
  readonly climate: ZoneClimateSnapshot;
  readonly deviceGroups: readonly ZoneDeviceGroup[];
  readonly actions: readonly ZoneActionButton[];
  readonly deviceControls: readonly ZoneDeviceControl[];
  readonly controls: ZoneControlCardsSnapshot;
}

export interface ZoneLightingControlSnapshot {
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

export interface ZoneClimateControlSnapshot {
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

export interface ZoneControlCardsSnapshot {
  readonly lighting: ZoneLightingControlSnapshot;
  readonly climate: ZoneClimateControlSnapshot;
}

const formatterWhole = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0
});

const formatterOneDecimal = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
});

const formatterTwoDecimal = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});

const PERCENT_UNIT_LABEL = "%" as const;
const SPARKLINE_POINT_COUNT = 24;
const DEFAULT_DISABLED_REASON = "Command wiring pending follow-up tasks." as const;
const DEFAULT_LIGHT_SCHEDULE: LightScheduleInput = Object.freeze({ onHours: 18, offHours: 6, startHour: 0 });
const DEFAULT_LIGHTING_DEVIATION: ControlCardDeviationThresholds = Object.freeze({
  warningDelta: 50,
  criticalDelta: 150
});
const DEFAULT_CLIMATE_DEVIATION: ControlCardDeviationThresholds = Object.freeze({
  warningDelta: 1,
  criticalDelta: 2
});
export const CAPACITY_ADVISOR_ACTION_LABEL = "Open Capacity Advisor" as const;

const DEFAULT_ZONE_DETAIL_SNAPSHOT: ZoneDetailSnapshot = Object.freeze({
  header: Object.freeze({
    structureName: "Structure",
    zoneName: "Zone",
    cultivarLabel: "Cultivar",
    stageLabel: "Stage",
    badges: Object.freeze([]),
    hints: Object.freeze([])
  }),
  kpis: Object.freeze({ metrics: Object.freeze([]) }),
  pest: Object.freeze({
    counts: Object.freeze({ activeIssues: 0, dueInspections: 0, cooldowns: 0 }),
    lastInspectionLabel: "—",
    nextInspectionLabel: "—",
    lastTreatmentLabel: "—",
    nextTreatmentLabel: "—",
    timeline: Object.freeze([]),
    context: Object.freeze({
      areaLabel: "—",
      volumeLabel: "—",
      plantCapacityLabel: "—",
      freePlantLabel: "—",
      densityLabel: "—",
      roomFreeAreaLabel: null,
      roomFreeVolumeLabel: null
    })
  }),
  climate: Object.freeze({ metrics: Object.freeze([]) }),
  deviceGroups: Object.freeze([]),
  actions: Object.freeze([]),
  deviceControls: Object.freeze([]),
  controls: Object.freeze({
    lighting: Object.freeze({
      title: "Lighting controls",
      description: null,
      measuredPpfd: 0,
      targetPpfd: 0,
      deviation: DEFAULT_LIGHTING_DEVIATION,
      schedule: DEFAULT_LIGHT_SCHEDULE,
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
        target: Object.freeze({ label: "Target", displayValue: "—" })
      }),
      humidity: Object.freeze({
        label: "Relative humidity",
        measured: Object.freeze({ label: "Measured", displayValue: "—" }),
        target: Object.freeze({ label: "Target", displayValue: "—" })
      }),
      co2: Object.freeze({
        label: "CO₂",
        measured: Object.freeze({ label: "Measured", displayValue: "—" }),
        target: Object.freeze({ label: "Target", displayValue: "—" })
      }),
      ach: Object.freeze({
        label: "Air changes per hour",
        measured: Object.freeze({ label: "Measured", displayValue: "—" }),
        target: Object.freeze({ label: "Target", displayValue: "—" }),
        deviation: DEFAULT_CLIMATE_DEVIATION
      }),
      deviceClasses: Object.freeze([]),
      ghostPlaceholders: Object.freeze([]),
      deviceSectionEmptyLabel: "No climate devices configured."
    })
  })
});

const ZONE_STAGE_BASELINES = Object.freeze({
  vegetative: Object.freeze({
    temperature_C: 24,
    relativeHumidity_percent: 63,
    co2_ppm: 900,
    vpd_kPa: 0.92
  }),
  flowering: Object.freeze({
    temperature_C: 24,
    relativeHumidity_percent: 55,
    co2_ppm: 1100,
    vpd_kPa: 1.1
  }),
  propagation: Object.freeze({
    temperature_C: 23,
    relativeHumidity_percent: 75,
    co2_ppm: 850,
    vpd_kPa: 0.7
  }),
  drying: Object.freeze({
    temperature_C: 20,
    relativeHumidity_percent: 50,
    co2_ppm: 450,
    vpd_kPa: 1
  }),
  default: Object.freeze({
    temperature_C: 23,
    relativeHumidity_percent: 60,
    co2_ppm: 800,
    vpd_kPa: 0.95
  })
});

const ZONE_STAGE_LIGHTING_TARGETS = Object.freeze({
  vegetative: 550,
  flowering: 780,
  propagation: 320,
  drying: 180,
  default: 500
});

const REQUIRED_LIGHTING_CLASSES = Object.freeze(["lighting"] as const);
export const REQUIRED_CLIMATE_CLASSES = Object.freeze(["climate", "airflow"] as const);
export const RELEVANT_CLIMATE_CLASSES = Object.freeze([
  "climate",
  "airflow",
  "co2",
  "humidifier",
  "dehumidifier",
  "heater"
] as const);

export function useZoneDetailView(
  structureId: string,
  roomId: string | null,
  zoneId: string
): ZoneDetailSnapshot {
  const structure = useStructureReadModel(structureId);
  const room = useRoomReadModel(structureId, roomId);
  const zone = useZoneReadModel(structureId, roomId, zoneId);
  const simulation = useSimulationReadModel();
  const lightSchedule = useZoneLightSchedule(zoneId);
  const zoneTelemetry = useZoneSnapshot(zoneId);

  return useMemo(() => {
    if (!zone) {
      return DEFAULT_ZONE_DETAIL_SNAPSHOT;
    }

  const header = buildZoneHeader(structure?.name ?? "Structure", room, zone);
    const kpis = buildZoneKpiOverview(zone);
    const context = buildZoneContext(room, zone);
    const pest = buildZonePestSnapshot(zone, context);
    const climate = buildZoneClimateSnapshot(room, zone);
    const deviceGroups = buildZoneDeviceGroups(structureId, roomId, zone);
    const actions = buildZoneActions(structureId, roomId, zone);
    const deviceControls = buildDeviceControls(structureId, roomId, zone);
    const controls = buildZoneControlCards(
      structureId,
      roomId,
      structure,
      room,
      zone,
      lightSchedule,
      zoneTelemetry
    );

    return {
      header,
      kpis,
      pest,
      climate,
      deviceGroups,
      actions,
      deviceControls,
      controls
    } satisfies ZoneDetailSnapshot;
  }, [
    structure?.name,
    room,
    zone,
    simulation.simTimeHours,
    structureId,
    roomId,
    lightSchedule,
    zoneTelemetry,
    structure
  ]);
}

function buildZoneHeader(
  structureName: string,
  room: RoomReadModel | null,
  zone: ZoneReadModel
): ZoneHeaderSnapshot {
  const badges: ZoneBadge[] = [
    {
      id: "cultivation",
      label: formatSlug(zone.cultivationMethodId),
      description: "Cultivation method"
    },
    {
      id: "irrigation",
      label: formatSlug(zone.irrigationMethodId),
      description: "Irrigation method"
    }
  ];

  const hints: string[] = [];
  const maxPlants = Math.max(0, zone.maxPlants);
  const currentPlants = Math.max(0, zone.currentPlantCount);
  const freePlants = Math.max(maxPlants - currentPlants, 0);

  hints.push(
    `${formatPlants(currentPlants)} · Max ${formatPlants(maxPlants)} (${formatPlants(freePlants)} free)`
  );

  const densityCurrent = computeDensity(currentPlants, zone.area_m2);
  const densityMax = computeDensity(maxPlants, zone.area_m2);
  hints.push(
    `Density ${formatterTwoDecimal.format(densityCurrent)} plants/m² (max ${formatterTwoDecimal.format(densityMax)})`
  );

  if (room) {
    hints.push(`Room: ${room.name}`);
  }

  return {
    structureName,
    zoneName: zone.name,
    cultivarLabel: formatSlug(zone.strainId),
    stageLabel: deriveZoneStageLabel(zone),
    badges,
    hints
  } satisfies ZoneHeaderSnapshot;
}

function buildZoneContext(room: RoomReadModel | null, zone: ZoneReadModel): ZoneContextSummary {
  const areaLabel = formatArea(zone.area_m2);
  const volumeLabel = formatVolume(zone.volume_m3);
  const maxPlants = Math.max(0, zone.maxPlants);
  const currentPlants = Math.max(0, zone.currentPlantCount);
  const freePlants = Math.max(maxPlants - currentPlants, 0);

  const plantCapacityLabel = `${formatPlants(currentPlants)} / ${formatPlants(maxPlants)} plants`;
  const freePlantLabel = `${formatPlants(freePlants)} plants free`;

  const densityCurrent = computeDensity(currentPlants, zone.area_m2);
  const densityMax = computeDensity(maxPlants, zone.area_m2);
  const densityLabel = `${formatterTwoDecimal.format(densityCurrent)} plants/m² (max ${formatterTwoDecimal.format(densityMax)})`;

  const roomFreeAreaLabel = room ? formatArea(room.capacity.areaFree_m2) : null;
  const roomFreeVolumeLabel = room ? formatVolume(room.capacity.volumeFree_m3) : null;

  return {
    areaLabel,
    volumeLabel,
    plantCapacityLabel,
    freePlantLabel,
    densityLabel,
    roomFreeAreaLabel,
    roomFreeVolumeLabel
  } satisfies ZoneContextSummary;
}

function buildZoneKpiOverview(zone: ZoneReadModel): ZoneKpiOverview {
  const metrics: ZoneKpiAggregate[] = [
    buildPercentAggregate(zone, "health"),
    buildPercentAggregate(zone, "quality"),
    buildPercentAggregate(zone, "stress")
  ];

  return { metrics } satisfies ZoneKpiOverview;
}

type PercentMetric = "health" | "quality" | "stress";

function buildPercentAggregate(zone: ZoneReadModel, metric: PercentMetric): ZoneKpiAggregate {
  const seed = `zone:${zone.id}:${metric}`;
  const base = getMetricMedian(zone, metric);
  const lowerSpread = getMetricLowerSpread(zone, metric);
  const upperSpread = getMetricUpperSpread(zone, metric);

  let minimum = clampPercent(base - lowerSpread);
  let maximum = clampPercent(base + upperSpread);

  if (maximum - minimum < 1) {
    minimum = clampPercent(base - 1);
    maximum = clampPercent(base + 1);
  }

  const sparkline = buildSparkline(zone.id, metric, base, minimum, maximum, seed);

  return {
    id: `zone-kpi-${metric}`,
    label: metricLabel(metric),
    median: roundPercent(base),
    minimum: roundPercent(minimum),
    maximum: roundPercent(maximum),
    unitLabel: PERCENT_UNIT_LABEL,
    sparkline
  } satisfies ZoneKpiAggregate;
}

function getMetricMedian(zone: ZoneReadModel, metric: PercentMetric): number {
  switch (metric) {
    case "health":
      return zone.kpis.healthPercent;
    case "quality":
      return zone.kpis.qualityPercent;
    case "stress":
      return zone.kpis.stressPercent;
    default:
      return 0;
  }
}

function getMetricLowerSpread(zone: ZoneReadModel, metric: PercentMetric): number {
  switch (metric) {
    case "health":
      return Math.max(2, Math.round(zone.kpis.stressPercent * 0.4));
    case "quality":
      return Math.max(2, Math.round(zone.kpis.stressPercent * 0.3));
    case "stress":
      return Math.max(1, Math.round(zone.kpis.stressPercent * 0.2));
    default:
      return 2;
  }
}

function getMetricUpperSpread(zone: ZoneReadModel, metric: PercentMetric): number {
  switch (metric) {
    case "health":
      return Math.max(3, Math.round(zone.kpis.growthRatePercent * 0.5));
    case "quality":
      return Math.max(3, Math.round(zone.kpis.growthRatePercent * 0.4));
    case "stress":
      return Math.max(2, Math.round((100 - zone.kpis.stressPercent) * 0.25));
    default:
      return 3;
  }
}

function buildSparkline(
  zoneId: string,
  metric: PercentMetric,
  median: number,
  minimum: number,
  maximum: number,
  seed: string
): readonly number[] {
  const rng = createRng(zoneId, seed);
  const span = Math.max(maximum - minimum, 1);
  const amplitude = span * 0.5;
  const center = clampPercent(median);
  const points: number[] = [];

  for (let index = 0; index < SPARKLINE_POINT_COUNT; index += 1) {
    const progress = index / (SPARKLINE_POINT_COUNT - 1);
    const wave = Math.sin(progress * Math.PI);
    const jitter = (rng() - 0.5) * span * 0.15;
    const value = clampPercent(center + wave * amplitude * 0.6 + jitter);
    points.push(Number((Math.round(value * 10) / 10).toFixed(1)));
  }

  return points;
}

function buildZonePestSnapshot(
  zone: ZoneReadModel,
  context: ZoneContextSummary
): ZonePestStatusSnapshot {
  const counts = {
    activeIssues: zone.pestStatus.activeIssues,
    dueInspections: zone.pestStatus.dueInspections,
    cooldowns: zone.pestStatus.upcomingTreatments
  } as const;

  const lastInspectionLabel = formatTick(zone.pestStatus.lastInspectionTick);
  const nextInspectionLabel = formatTick(zone.pestStatus.nextInspectionTick);
  const lastTreatmentLabel = formatTick(findLastTreatmentTimestamp(zone.timeline));
  const nextTreatmentLabel = formatTick(findNextTreatmentTick(zone.tasks));

  const timeline = zone.timeline
    .filter((entry) => entry.scope === "zone")
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 4)
    .map(toPestTimelineItem);

  return {
    counts,
    lastInspectionLabel,
    nextInspectionLabel,
    lastTreatmentLabel,
    nextTreatmentLabel,
    timeline,
    context
  } satisfies ZonePestStatusSnapshot;
}

function toPestTimelineItem(entry: TimelineEntry): ZonePestTimelineItem {
  return {
    id: entry.id,
    title: entry.title,
    statusLabel: formatStatus(entry.status),
    timestampLabel: formatTick(entry.timestamp)
  } satisfies ZonePestTimelineItem;
}

function buildZoneClimateSnapshot(
  room: RoomReadModel | null,
  zone: ZoneReadModel
): ZoneClimateSnapshot {
  const baseline = selectStageBaseline(zone, room);

  const metrics: ZoneClimateMetric[] = [
    createClimateMetric(
      "temperature",
      "Temperature",
      zone.climateSnapshot.temperature_C,
      baseline.temperature_C,
      1.2
    ),
    createClimateMetric(
      "humidity",
      "Relative humidity",
      zone.climateSnapshot.relativeHumidity_percent,
      baseline.relativeHumidity_percent,
      5
    ),
    createClimateMetric("co2", "CO₂", zone.climateSnapshot.co2_ppm, baseline.co2_ppm, 120),
    createClimateMetric("vpd", "VPD", zone.climateSnapshot.vpd_kPa, baseline.vpd_kPa, 0.15),
    createClimateMetric(
      "ach",
      "Air changes per hour",
      zone.climateSnapshot.ach_measured,
      zone.climateSnapshot.ach_target,
      0.4
    )
  ];

  return { metrics } satisfies ZoneClimateSnapshot;
}

function createClimateMetric(
  id: string,
  label: string,
  measured: number,
  target: number,
  tolerance: number
): ZoneClimateMetric {
  const status = deriveClimateStatus(measured, target, tolerance);
  const measuredLabel = formatMeasuredValue(id, measured);
  const targetLabel = `Target ${formatMeasuredValue(id, target)}`;

  return {
    id: `zone-climate-${id}`,
    label,
    measuredLabel,
    targetLabel,
    status,
    statusLabel: statusLabel(status)
  } satisfies ZoneClimateMetric;
}

function buildZoneControlCards(
  structureId: string,
  roomId: string | null,
  structure: StructureReadModel | null,
  room: RoomReadModel | null,
  zone: ZoneReadModel,
  schedule: LightScheduleInput,
  telemetry: TelemetryZoneSnapshotPayload | null
): ZoneControlCardsSnapshot {
  const normalizedSchedule = normalizeLightSchedule(schedule);

  const lighting = buildZoneLightingControl(
    structureId,
    roomId,
    room,
    zone,
    normalizedSchedule,
    telemetry
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
  telemetry: TelemetryZoneSnapshotPayload | null
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
    onTargetChange: (nextValue: number) => {
      console.info("[stub] set zone lighting target", {
        structureId,
        roomId,
        zoneId: zone.id,
        targetPPFD: nextValue
      });
    },
    onScheduleSubmit: (nextSchedule: LightScheduleInput) => {
      recordZoneLightSchedule(zone.id, nextSchedule);
      console.info("[stub] set zone lighting schedule", {
        structureId,
        roomId,
        zoneId: zone.id,
        schedule: nextSchedule
      });
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
      onToggle: (nextEnabled: boolean) => {
        console.info("[stub] toggle zone lighting device", {
          zoneId: zone.id,
          deviceId: device.id,
          nextEnabled
        });
      },
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
  const relevantClasses = new Set(RELEVANT_CLIMATE_CLASSES);
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
    onToggleEnabled: (nextEnabled: boolean) => {
      console.info("[stub] toggle climate device", {
        zoneId: zone.id,
        deviceId: device.id,
        nextEnabled
      });
    },
    onMove: () => {
      console.info("[stub] move climate device", { zoneId: zone.id, deviceId: device.id });
    },
    onRemove: () => {
      console.info("[stub] remove climate device", { zoneId: zone.id, deviceId: device.id });
    },
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

function buildZoneDeviceGroups(
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

function createDeviceGroupBuilder(id: string): ZoneDeviceGroupBuilder {
  return { id, devices: [], warnings: [] } satisfies ZoneDeviceGroupBuilder;
}

function createDeviceTile(zone: ZoneReadModel, device: DeviceSummary): ZoneDeviceTile {
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

function buildContributionLabel(zone: ZoneReadModel, device: DeviceSummary): string {
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

function buildCapLabel(zone: ZoneReadModel, device: DeviceSummary): string {
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

function needsCoverageWarning(zone: ZoneReadModel, device: DeviceSummary): boolean {
  if (device.coverageArea_m2 > 0) {
    return computeCoveragePercent(device.coverageArea_m2, zone.area_m2) < 95;
  }

  if (device.airflow_m3_per_hour > 0) {
    return computeCoveragePercent(device.airflow_m3_per_hour, zone.volume_m3) < 95;
  }

  return false;
}

function createDeviceControlActions(
  structureId: string,
  roomId: string | null,
  zoneId: string,
  groupId: string
): ZoneDeviceControl[] {
  const config = lookupDeviceControl(groupId);

  if (!config) {
    return [];
  }

  return [
    {
      id: `zone-device-control-${groupId}`,
      label: config.label,
      onSelect: () => {
        console.info("[stub] zone device control", { structureId, roomId, zoneId, groupId });
      },
      disabledReason: config.disabledReason
    }
  ];
}

function lookupDeviceControl(groupId: string): DeviceControlConfig | null {
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

function buildZoneActions(
  structureId: string,
  roomId: string | null,
  zone: ZoneReadModel
): ZoneActionButton[] {
  const hasPlants = zone.currentPlantCount > 0;

  return [
    {
      id: "zone-action-harvest",
      label: "Harvest zone",
      disabled: !hasPlants,
      disabledReason: hasPlants ? DEFAULT_DISABLED_REASON : "Zone is empty. Sow before harvesting.",
      onSelect: () => {
        console.info("[stub] harvest zone", { structureId, roomId, zoneId: zone.id });
      }
    },
    {
      id: "zone-action-cull",
      label: "Cull plants",
      disabled: !hasPlants,
      disabledReason: hasPlants ? DEFAULT_DISABLED_REASON : "No plants available to cull.",
      onSelect: () => {
        console.info("[stub] cull plants", { structureId, roomId, zoneId: zone.id });
      }
    },
    {
      id: "zone-action-sow",
      label: "Sow seedlings",
      disabled: hasPlants,
      disabledReason: hasPlants ? "Sowing requires an empty zone." : DEFAULT_DISABLED_REASON,
      onSelect: () => {
        console.info("[stub] sow seedlings", { structureId, roomId, zoneId: zone.id });
      }
    }
  ];
}

function buildDeviceControls(
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

function formatArea(value: number): string {
  return `${formatterWhole.format(Math.round(Math.max(value, 0)))} m²`;
}

function formatVolume(value: number): string {
  return `${formatterWhole.format(Math.round(Math.max(value, 0)))} m³`;
}

function formatAirflow(value: number): string {
  return `${formatterWhole.format(Math.round(Math.max(value, 0)))} m³/h`;
}

function formatPlants(value: number): string {
  return formatterWhole.format(Math.round(Math.max(value, 0)));
}

function computeDensity(plants: number, area: number): number {
  if (area <= 0) {
    return 0;
  }
  return Math.max(plants, 0) / area;
}

function computeCoveragePercent(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((Math.max(value, 0) / total) * 100);
}

function metricLabel(metric: PercentMetric): string {
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

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

function clamp01(value: number): number {
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

function roundPercent(value: number): number {
  return Math.round(clampPercent(value));
}

function formatSlug(slug: string): string {
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

function formatTick(tick: number | null | undefined): string {
  if (typeof tick !== "number" || !Number.isFinite(tick)) {
    return "—";
  }

  const safeTick = Math.max(0, Math.floor(tick));
  const day = Math.floor(safeTick / HOURS_PER_DAY) + 1;
  const hour = safeTick % HOURS_PER_DAY;
  const hourLabel = hour.toString().padStart(2, "0");

  return `Day ${formatterWhole.format(day)}, ${hourLabel}:00`;
}

function findLastTreatmentTimestamp(timeline: readonly TimelineEntry[]): number | null {
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

function findNextTreatmentTick(tasks: readonly ZoneTaskEntry[]): number | null {
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

function formatStatus(status: TimelineEntry["status"]): string {
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

function selectStageBaseline(
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

function inferLightingTargetFromText(text: string | null | undefined): number {
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

function deriveClimateStatus(
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

function statusLabel(status: "ok" | "warn" | "critical"): string {
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

function formatMeasuredValue(metricId: string, value: number): string {
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

function inferWarningGroup(message: string): string | null {
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

function formatDeviceClass(classId: string): string {
  return formatSlug(classId);
}

/* eslint-enable @typescript-eslint/no-magic-numbers */

