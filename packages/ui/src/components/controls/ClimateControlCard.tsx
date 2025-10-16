import { useId, type ReactElement } from "react";
import {
  ControlCard,
  type ControlCardDeviationThresholds,
  type ControlCardGhostActionPayload,
  type ControlCardGhostPlaceholderDefinition,
  type ControlCardMetricValue
} from "@ui/components/controls/ControlCard";
import { cn } from "@ui/lib/cn";
import { formatCapacityPercentage, formatThroughputPercentage } from "@ui/lib/percentageFormatting";

const defaultTitle = "Climate controls";
const defaultDeviationFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  signDisplay: "always"
});

interface DeviationBadgeDescriptor {
  readonly severity: "warning" | "critical";
  readonly valueLabel: string;
}

export interface ClimateControlMetricDefinition {
  readonly label: string;
  readonly measured: ControlCardMetricValue;
  readonly target: ControlCardMetricValue;
  readonly deviation?: ControlCardDeviationThresholds;
  readonly toleranceLabel?: string;
}

export interface ClimateControlDeviceTileProps {
  readonly id: string;
  readonly name: string;
  readonly throughputFraction01: number;
  readonly capacityFraction01: number;
  readonly isEnabled: boolean;
  readonly onToggleEnabled: (nextEnabled: boolean) => void;
  readonly onMove?: () => void;
  readonly onRemove?: () => void;
  readonly description?: string;
}

export interface ClimateControlDeviceClassSection {
  readonly classId: string;
  readonly label: string;
  readonly devices: readonly ClimateControlDeviceTileProps[];
}

export interface ClimateControlCardProps {
  readonly title?: string;
  readonly description?: string;
  readonly temperature: ClimateControlMetricDefinition;
  readonly humidity: ClimateControlMetricDefinition;
  readonly co2: ClimateControlMetricDefinition;
  readonly ach: ClimateControlMetricDefinition;
  readonly deviceClasses?: readonly ClimateControlDeviceClassSection[];
  readonly ghostPlaceholders?: readonly ControlCardGhostPlaceholderDefinition[];
  readonly deviceSectionEmptyLabel?: string;
  readonly onGhostAction?: (payload: ControlCardGhostActionPayload) => void;
}

type MetricEntry = readonly [id: string, config: ClimateControlMetricDefinition];

export function ClimateControlCard({
  title = defaultTitle,
  description,
  temperature,
  humidity,
  co2,
  ach,
  deviceClasses = [],
  ghostPlaceholders,
  deviceSectionEmptyLabel,
  onGhostAction
}: ClimateControlCardProps): ReactElement {
  const metricEntries: MetricEntry[] = [
    ["temperature", temperature],
    ["humidity", humidity],
    ["co2", co2],
    ["ach", ach]
  ];

  const deviceTiles = deviceClasses.flatMap((section) =>
    section.devices.map((device) => (
      <ClimateDeviceTile key={`${section.classId}-${device.id}`} classLabel={section.label} {...device} />
    ))
  );

  const hasDevices = deviceTiles.length > 0;
  const classHasDevices = new Map<string, boolean>();
  for (const section of deviceClasses) {
    classHasDevices.set(section.classId, section.devices.length > 0);
  }

  const resolvedGhosts = (ghostPlaceholders ?? []).filter((placeholder) => {
    return !classHasDevices.get(placeholder.deviceClassId);
  });

  const hasDeviceSection =
    hasDevices || resolvedGhosts.length > 0 || typeof deviceSectionEmptyLabel === "string";

  return (
    <ControlCard
      title={title}
      description={description}
      measured={temperature.measured}
      target={temperature.target}
      deviation={temperature.deviation}
      deviceSection={
        hasDeviceSection
          ? {
              children: deviceTiles,
              ghostPlaceholders: resolvedGhosts.length > 0 ? resolvedGhosts : undefined,
              emptyLabel: deviceSectionEmptyLabel
            }
          : undefined
      }
      onGhostAction={onGhostAction}
    >
      <ClimateMetricGrid entries={metricEntries} />
    </ControlCard>
  );
}

function ClimateMetricGrid({ entries }: { readonly entries: readonly MetricEntry[] }): ReactElement {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {entries.map(([id, metric]) => (
        <ClimateMetricSection key={id} id={id} {...metric} />
      ))}
    </div>
  );
}

interface ClimateMetricSectionProps extends ClimateControlMetricDefinition {
  readonly id: string;
}

function ClimateMetricSection({
  id,
  label,
  measured,
  target,
  deviation,
  toleranceLabel
}: ClimateMetricSectionProps): ReactElement {
  const headingId = useId();
  const toleranceId = useId();
  const deviationBadge = resolveDeviationBadge(measured, target, deviation);

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-xl border border-border-base/60 bg-canvas-subtle/40 p-4"
      data-metric-id={id}
      role="region"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-text-primary" id={headingId}>
            {label}
          </h3>
          {toleranceLabel ? (
            <p className="text-xs text-text-muted" id={toleranceId}>
              {toleranceLabel}
            </p>
          ) : null}
        </div>
        {deviationBadge ? (
          <DeviationBadge
            ariaLabel={`${label} deviation ${deviationBadge.valueLabel}`}
            severity={deviationBadge.severity}
            valueLabel={deviationBadge.valueLabel}
          />
        ) : null}
      </div>
      <dl className="grid gap-2 text-sm text-text-primary">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-xs uppercase tracking-[0.18em] text-accent-muted">{measured.label}</dt>
          <dd className="text-base font-semibold text-text-primary">{measured.displayValue}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-xs uppercase tracking-[0.18em] text-accent-muted">{target.label}</dt>
          <dd className="text-base font-semibold text-text-primary">{target.displayValue}</dd>
        </div>
      </dl>
    </section>
  );
}

function resolveDeviationBadge(
  measured: ControlCardMetricValue,
  target: ControlCardMetricValue,
  thresholds: ControlCardDeviationThresholds | undefined
): DeviationBadgeDescriptor | null {
  if (!thresholds || measured.numericValue === undefined || target.numericValue === undefined) {
    return null;
  }

  const delta = measured.numericValue - target.numericValue;
  const absoluteDelta = Math.abs(delta);
  if (absoluteDelta < thresholds.warningDelta) {
    return null;
  }

  const severity: DeviationBadgeDescriptor["severity"] =
    thresholds.criticalDelta !== undefined && absoluteDelta >= thresholds.criticalDelta ? "critical" : "warning";
  const formatter = thresholds.formatDelta ?? ((value: number) => defaultDeviationFormatter.format(value));

  return {
    severity,
    valueLabel: formatter(delta)
  };
}

interface DeviationBadgeProps extends DeviationBadgeDescriptor {
  readonly ariaLabel: string;
}

function DeviationBadge({ severity, valueLabel, ariaLabel }: DeviationBadgeProps): ReactElement {
  const baseClass =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]";
  const severityClass =
    severity === "critical"
      ? "border-accent-critical/70 bg-accent-critical/10 text-accent-critical"
      : "border-accent-warning/60 bg-accent-warning/10 text-accent-warning";

  return (
    <span aria-label={ariaLabel} className={cn(baseClass, severityClass)} data-variant={severity} role="status">
      <span aria-hidden="true">Δ</span>
      <span>{valueLabel}</span>
    </span>
  );
}

interface ClimateDeviceTileInternalProps extends ClimateControlDeviceTileProps {
  readonly classLabel: string;
}

function ClimateDeviceTile({
  classLabel,
  name,
  description,
  throughputFraction01,
  capacityFraction01,
  isEnabled,
  onToggleEnabled,
  onMove,
  onRemove
}: ClimateDeviceTileInternalProps): ReactElement {
  const throughputLabel = formatThroughputPercentage(throughputFraction01);
  const capacityLabel = formatCapacityPercentage(capacityFraction01);
  const statusLabel = isEnabled ? "Enabled" : "Disabled";
  const toggleLabel = isEnabled ? "Disable" : "Enable";

  return (
    <div className="flex h-full flex-col justify-between gap-4 p-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="inline-flex items-center rounded-full border border-border-base/60 bg-canvas-subtle px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-accent-muted">
              {classLabel}
            </span>
            <p className="text-sm font-semibold text-text-primary">{name}</p>
          </div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-accent-muted">{statusLabel}</span>
        </div>
        {description ? <p className="text-xs text-text-muted">{description}</p> : null}
        <dl className="space-y-2 text-sm text-text-primary">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs uppercase tracking-[0.18em] text-accent-muted">Throughput</dt>
            <dd className="font-semibold text-text-primary">{throughputLabel}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs uppercase tracking-[0.18em] text-accent-muted">Capacity</dt>
            <dd className="font-semibold text-text-primary">{capacityLabel}</dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            "inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition",
            isEnabled
              ? "border-border-strong bg-surface-critical/10 text-text-critical hover:bg-surface-critical/20"
              : "border-accent-primary/60 bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20"
          )}
          onClick={() => {
            onToggleEnabled(!isEnabled);
          }}
          aria-pressed={isEnabled}
        >
          {toggleLabel}
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-border-base/60 bg-canvas-subtle px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-canvas-subtle/80 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onMove}
          disabled={!onMove}
        >
          Move
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-border-strong bg-surface-critical/10 px-3 py-2 text-sm font-medium text-text-critical transition hover:bg-surface-critical/20 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRemove}
          disabled={!onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
