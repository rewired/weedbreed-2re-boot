import { useMemo } from "react";
import {
  type ControlCardDeviationThresholds,
  type ControlCardGhostPlaceholderDefinition
} from "@ui/components/controls/ControlCard";
import type {
  ClimateControlDeviceClassSection,
  ClimateControlMetricDefinition
} from "@ui/components/controls/ClimateControlCard";
import type { LightingDeviceTileProps } from "@ui/components/controls/LightingControlCard";
import type { LightScheduleInput } from "@ui/lib/lightScheduleValidation";
import { useIntentClient } from "@ui/transport";
import { createRng } from "@ui/lib/createRng";
import {
  useRoomReadModel,
  useSimulationReadModel,
  useStructureReadModel,
  useZoneReadModel
} from "@ui/lib/readModelHooks";
import type {
  RoomReadModel,
  TimelineEntry,
  ZoneReadModel
} from "@ui/state/readModels.types";
import { useZoneLightSchedule } from "@ui/state/intents";
import { useZoneSnapshot } from "@ui/state/telemetry";
import { buildZoneControlCards } from "./zoneDetailControls";
import {
  buildDeviceControls,
  buildZoneActions,
  buildZoneDeviceGroups,
  clampPercent,
  computeDensity,
  deriveClimateStatus,
  deriveZoneStageLabel,
  findLastTreatmentTimestamp,
  findNextTreatmentTick,
  formatArea,
  formatMeasuredValue,
  formatPlants,
  formatSlug,
  formatStatus,
  formatTick,
  formatVolume,
  metricLabel,
  roundPercent,
  selectStageBaseline,
  statusLabel
} from "./zoneDetailHelpers";

export {
  deriveZoneStageLabel,
  selectRoomLightingFallbackTarget,
  selectStageLightingTarget
} from "./zoneDetailHelpers";

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
  readonly onTargetChange?: (nextValue: number) => void;
  readonly onScheduleSubmit?: (schedule: LightScheduleInput) => void;
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

const formatterTwoDecimal = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});

const PERCENT_UNIT_LABEL = "%" as const;
const SPARKLINE_POINT_COUNT = 24;
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
  const intentClient = useIntentClient();
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
      zoneTelemetry,
      intentClient
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
    structure,
    intentClient
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
