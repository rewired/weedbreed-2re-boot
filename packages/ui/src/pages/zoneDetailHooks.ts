import { useMemo } from "react";
import { useZoneSnapshot } from "@ui/state/telemetry";

export interface ZoneDetailMetadata {
  readonly structureId: string;
  readonly structureName: string;
  readonly zoneId: string;
  readonly zoneName: string;
  readonly cultivationMethodId: string;
  readonly cultivarName: string;
  readonly currentStage: string;
  readonly areaSquareMeters: number;
}

export interface ZoneTelemetryMetric {
  readonly id: string;
  readonly label: string;
  readonly unitLabel: string;
  readonly formattedValue: string;
  readonly description: string;
  readonly isAvailable: boolean;
  readonly unavailableReason: string;
}

export interface ZoneDeviceCoverageSummary {
  readonly id: string;
  readonly title: string;
  readonly coverageLabel: string;
  readonly status: "ok" | "pending" | "undersupplied";
  readonly notes: string;
}

export interface ZoneIntentPlaceholderAction {
  readonly id: string;
  readonly label: string;
  readonly disabledReason: string;
}

export interface ZoneDetailSnapshot {
  readonly metadata: ZoneDetailMetadata;
  readonly metrics: readonly ZoneTelemetryMetric[];
  readonly coverage: readonly ZoneDeviceCoverageSummary[];
  readonly actions: readonly ZoneIntentPlaceholderAction[];
}

const ZONE_DETAIL_STUB_AREA_M2 = 48;
const ZONE_DETAIL_STUB_PPFD = 520;
const ZONE_DETAIL_STUB_DLI = 32;
const ZONE_DETAIL_STUB_TEMPERATURE = 25.4;
const ZONE_DETAIL_STUB_RELATIVE_HUMIDITY = 62;
const ZONE_DETAIL_STUB_CO2 = 820;
const ZONE_DETAIL_STUB_ACH = 5.8;

const zoneDetailStubSnapshot: ZoneDetailSnapshot = Object.freeze({
  metadata: Object.freeze({
    structureId: "structure-stub",
    structureName: "Structure Placeholder",
    zoneId: "zone-stub",
    zoneName: "Zone Placeholder",
    cultivationMethodId: "sea-of-green",
    cultivarName: "Northern Lights",
    currentStage: "Vegetative",
    areaSquareMeters: ZONE_DETAIL_STUB_AREA_M2
  }),
  metrics: Object.freeze([
    Object.freeze({
      id: "zone-metric-ppfd",
      label: "PPFD",
      unitLabel: "µmol/m²/s",
      formattedValue: String(ZONE_DETAIL_STUB_PPFD),
      description: "Target band for vegetative canopy lighting.",
      isAvailable: false,
      unavailableReason: "Telemetry pending from canopy sensors (Task 0031 wiring)."
    }),
    Object.freeze({
      id: "zone-metric-dli",
      label: "Daily light integral",
      unitLabel: "mol/m²/day",
      formattedValue: String(ZONE_DETAIL_STUB_DLI),
      description: "Derived from hourly PPFD integration per SEC §4.2.",
      isAvailable: false,
      unavailableReason: "Telemetry pending from canopy sensors (Task 0031 wiring)."
    }),
    Object.freeze({
      id: "zone-metric-temperature",
      label: "Air temperature",
      unitLabel: "°C",
      formattedValue: String(ZONE_DETAIL_STUB_TEMPERATURE),
      description: "Dry-bulb reading for zone environmental control.",
      isAvailable: false,
      unavailableReason: "Telemetry pending from climate nodes (Task 0031 wiring)."
    }),
    Object.freeze({
      id: "zone-metric-relative-humidity",
      label: "Relative humidity",
      unitLabel: "%",
      formattedValue: String(ZONE_DETAIL_STUB_RELATIVE_HUMIDITY),
      description: "Humidity converted to percentage for UI display.",
      isAvailable: false,
      unavailableReason: "Telemetry pending from climate nodes (Task 0031 wiring)."
    }),
    Object.freeze({
      id: "zone-metric-co2",
      label: "CO₂ concentration",
      unitLabel: "ppm",
      formattedValue: String(ZONE_DETAIL_STUB_CO2),
      description: "Concentration expressed in parts per million.",
      isAvailable: false,
      unavailableReason: "Telemetry pending from gas sensors (Task 0031 wiring)."
    }),
    Object.freeze({
      id: "zone-metric-ach",
      label: "Air changes per hour",
      unitLabel: "ACH",
      formattedValue: String(ZONE_DETAIL_STUB_ACH),
      description: "Derived from airflow ÷ zone volume per SEC §4.2 phase 3.",
      isAvailable: false,
      unavailableReason: "Telemetry pending from airflow monitors (Task 0031 wiring)."
    })
  ]),
  coverage: Object.freeze([
    Object.freeze({
      id: "zone-coverage-lighting",
      title: "Lighting coverage",
      coverageLabel: "95% of canopy target",
      status: "pending",
      notes: "Placeholder diagnostics until device coverage rollups land with telemetry integration."
    }),
    Object.freeze({
      id: "zone-coverage-hvac",
      title: "HVAC airflow",
      coverageLabel: "ACH target pending",
      status: "pending",
      notes: "Awaiting SEC §4.2 airflow reconciliation; ventilation summary will surface undersupply warnings."
    }),
    Object.freeze({
      id: "zone-coverage-irrigation",
      title: "Irrigation readiness",
      coverageLabel: "Schedules staged",
      status: "pending",
      notes: "Irrigation schedules will be hydrated once intent Task 0036 wires command panels."
    })
  ]),
  actions: Object.freeze([
    Object.freeze({
      id: "zone-action-adjust-lighting",
      label: "Adjust lighting schedule",
      disabledReason: "Intent wiring (Task 0035) will enable lighting adjustments from this panel."
    }),
    Object.freeze({
      id: "zone-action-irrigation",
      label: "Schedule irrigation",
      disabledReason: "Intent wiring (Task 0036) will enable irrigation adjustments from this panel."
    }),
    Object.freeze({
      id: "zone-action-harvest",
      label: "Plan harvest",
      disabledReason: "Intent wiring (Task 0032/0033) will expose readiness tasks here."
    })
  ])
});

export type ZoneDetailMetadataOverrides = Partial<ZoneDetailMetadata>;

export function useZoneDetailSnapshot(overrides?: ZoneDetailMetadataOverrides): ZoneDetailSnapshot {
  const metadata = useMemo(
    () => ({ ...zoneDetailStubSnapshot.metadata, ...overrides }),
    [overrides]
  );
  const zoneTelemetry = useZoneSnapshot(metadata.zoneId);

  const metrics = useMemo(() => {
    if (!zoneTelemetry) {
      return zoneDetailStubSnapshot.metrics;
    }

    return zoneDetailStubSnapshot.metrics.map((metric) => {
      switch (metric.id) {
        case "zone-metric-ppfd":
          return {
            ...metric,
            formattedValue: formatWhole(zoneTelemetry.ppfd),
            isAvailable: Number.isFinite(zoneTelemetry.ppfd),
            unavailableReason: metric.unavailableReason
          } satisfies ZoneTelemetryMetric;
        case "zone-metric-dli":
          return {
            ...metric,
            formattedValue: formatOneDecimal(zoneTelemetry.dli_incremental),
            isAvailable: Number.isFinite(zoneTelemetry.dli_incremental),
            unavailableReason: metric.unavailableReason
          } satisfies ZoneTelemetryMetric;
        case "zone-metric-temperature":
          return {
            ...metric,
            formattedValue: formatOneDecimal(zoneTelemetry.temp_c),
            isAvailable: Number.isFinite(zoneTelemetry.temp_c),
            unavailableReason: metric.unavailableReason
          } satisfies ZoneTelemetryMetric;
        case "zone-metric-relative-humidity":
          return {
            ...metric,
            formattedValue: formatWhole(zoneTelemetry.rh),
            isAvailable: Number.isFinite(zoneTelemetry.rh),
            unavailableReason: metric.unavailableReason
          } satisfies ZoneTelemetryMetric;
        case "zone-metric-co2":
          return {
            ...metric,
            formattedValue: formatWhole(zoneTelemetry.co2_ppm),
            isAvailable: Number.isFinite(zoneTelemetry.co2_ppm),
            unavailableReason: metric.unavailableReason
          } satisfies ZoneTelemetryMetric;
        case "zone-metric-ach":
          return {
            ...metric,
            formattedValue: formatOneDecimal(zoneTelemetry.ach),
            isAvailable: Number.isFinite(zoneTelemetry.ach),
            unavailableReason: metric.unavailableReason
          } satisfies ZoneTelemetryMetric;
        default:
          return metric;
      }
    });
  }, [zoneTelemetry]);

  return useMemo(
    () => ({
      metadata,
      metrics,
      coverage: zoneDetailStubSnapshot.coverage,
      actions: zoneDetailStubSnapshot.actions
    }),
    [metadata, metrics]
  );
}

function formatWhole(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toString() : "—";
}

function formatOneDecimal(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return (Math.round(value * 10) / 10).toString();
}
