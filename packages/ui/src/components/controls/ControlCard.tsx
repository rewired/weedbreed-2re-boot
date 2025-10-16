import { Children, type ReactElement, type ReactNode, useId } from "react";
import { cn } from "@ui/lib/cn";

const defaultDeviationFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  signDisplay: "always"
});

export interface ControlCardMetricValue {
  readonly label: string;
  readonly displayValue: string;
  readonly numericValue?: number;
}

export interface ControlCardDeviationThresholds {
  /** Absolute delta that triggers a warning badge. */
  readonly warningDelta: number;
  /** Absolute delta that triggers a critical badge. */
  readonly criticalDelta?: number;
  /** Optional custom formatter for the measured-target delta. */
  readonly formatDelta?: (delta: number) => string;
}

export interface ControlCardGhostPlaceholderDefinition {
  readonly deviceClassId: string;
  readonly label: string;
  readonly description: string;
  readonly actionLabel?: string;
}

export interface ControlCardGhostActionPayload {
  readonly type: "missing-device-class";
  readonly deviceClassId: string;
  readonly cardTitle: string;
  readonly placeholderLabel: string;
}

export interface ControlCardDeviceSectionProps {
  readonly children?: ReactNode;
  readonly ghostPlaceholders?: readonly ControlCardGhostPlaceholderDefinition[];
  readonly emptyLabel?: string;
}

export interface ControlCardProps {
  readonly title: string;
  readonly measured: ControlCardMetricValue;
  readonly target?: ControlCardMetricValue;
  readonly deviation?: ControlCardDeviationThresholds;
  readonly description?: string;
  readonly children?: ReactNode;
  readonly deviceSection?: ControlCardDeviceSectionProps;
  readonly onGhostAction?: (payload: ControlCardGhostActionPayload) => void;
}

interface DeviationBadgeProps {
  readonly severity: "warning" | "critical";
  readonly valueLabel: string;
}

function resolveDeviation(
  measured: ControlCardMetricValue,
  target: ControlCardMetricValue | undefined,
  thresholds: ControlCardDeviationThresholds | undefined
): DeviationBadgeProps | null {
  if (!thresholds || !target || measured.numericValue === undefined || target.numericValue === undefined) {
    return null;
  }

  const delta = measured.numericValue - target.numericValue;
  const absoluteDelta = Math.abs(delta);
  if (absoluteDelta < thresholds.warningDelta) {
    return null;
  }

  const severity = thresholds.criticalDelta !== undefined && absoluteDelta >= thresholds.criticalDelta ? "critical" : "warning";
  const formatter = thresholds.formatDelta ?? ((value: number) => defaultDeviationFormatter.format(value));
  return {
    severity,
    valueLabel: formatter(delta)
  };
}

export function ControlCard({
  title,
  measured,
  target,
  deviation,
  description,
  children,
  deviceSection,
  onGhostAction
}: ControlCardProps): ReactElement {
  const headingId = useId();
  const descriptionId = useId();
  const deviationBadge = resolveDeviation(measured, target, deviation);

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-6 rounded-2xl border border-border-base bg-canvas-raised/70"
    >
      <header className="flex flex-col gap-4 border-b border-border-base px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-text-primary" id={headingId}>
            {title}
          </h2>
          {description ? (
            <p className="text-sm text-text-muted" id={descriptionId}>
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <dl className="flex flex-wrap items-end gap-x-6 gap-y-3 text-sm text-text-primary" aria-describedby={description ? descriptionId : undefined}>
            <div className="flex flex-col gap-1">
              <dt className="text-xs uppercase tracking-[0.2em] text-accent-muted">{measured.label}</dt>
              <dd className="text-base font-semibold text-text-primary">{measured.displayValue}</dd>
            </div>
            {target ? (
              <div className="flex flex-col gap-1">
                <dt className="text-xs uppercase tracking-[0.2em] text-accent-muted">{target.label}</dt>
                <dd className="text-base font-semibold text-text-primary">{target.displayValue}</dd>
              </div>
            ) : null}
          </dl>
          {deviationBadge ? <DeviationBadge {...deviationBadge} /> : null}
        </div>
      </header>
      <div className="space-y-6 px-6 pb-6">
        {children}
        {deviceSection ? (
          <ControlCardDeviceGrid
            cardTitle={title}
            emptyLabel={deviceSection.emptyLabel}
            ghostPlaceholders={deviceSection.ghostPlaceholders}
            onGhostAction={onGhostAction}
          >
            {deviceSection.children}
          </ControlCardDeviceGrid>
        ) : null}
      </div>
    </section>
  );
}

function DeviationBadge({ severity, valueLabel }: DeviationBadgeProps): ReactElement {
  const baseClass = "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]";
  const severityClass =
    severity === "critical"
      ? "border-accent-critical/70 bg-accent-critical/10 text-accent-critical"
      : "border-accent-warning/60 bg-accent-warning/10 text-accent-warning";

  return (
    <span
      aria-label={`Deviation ${valueLabel}`}
      className={cn(baseClass, severityClass)}
      data-variant={severity}
      role="status"
    >
      <span aria-hidden="true">Δ</span>
      <span>{valueLabel}</span>
    </span>
  );
}

interface ControlCardDeviceGridProps extends ControlCardDeviceSectionProps {
  readonly cardTitle: string;
  readonly onGhostAction?: (payload: ControlCardGhostActionPayload) => void;
  readonly children?: ReactNode;
}

function ControlCardDeviceGrid({
  children,
  ghostPlaceholders,
  emptyLabel = "No devices configured yet.",
  cardTitle,
  onGhostAction
}: ControlCardDeviceGridProps): ReactElement | null {
  const tiles = Children.toArray(children);
  const hasTiles = tiles.length > 0;
  const ghosts = ghostPlaceholders ?? [];
  const hasGhosts = ghosts.length > 0;

  if (!hasTiles && !hasGhosts) {
    return (
      <div className="grid gap-4 sm:grid-cols-2" role="list">
        <div
          className="col-span-full rounded-xl border border-dashed border-border-base/60 p-4 text-sm text-text-muted"
          role="listitem"
        >
          {emptyLabel}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2" role="list">
      {tiles.map((tile, index) => {
        const key = (tile as { key?: string | number | null }).key ?? index;
        return (
          <div className="rounded-xl border border-border-base/60 bg-canvas-subtle/40" key={key} role="listitem">
            {tile}
          </div>
        );
      })}
      {ghosts.map((placeholder) => (
        <div key={placeholder.deviceClassId} role="listitem">
          <GhostPlaceholder
            actionLabel={placeholder.actionLabel}
            cardTitle={cardTitle}
            description={placeholder.description}
            deviceClassId={placeholder.deviceClassId}
            label={placeholder.label}
            onGhostAction={onGhostAction}
          />
        </div>
      ))}
    </div>
  );
}

interface GhostPlaceholderProps extends ControlCardGhostPlaceholderDefinition {
  readonly cardTitle: string;
  readonly onGhostAction?: (payload: ControlCardGhostActionPayload) => void;
}

function GhostPlaceholder({
  actionLabel = "Resolve",
  cardTitle,
  description,
  deviceClassId,
  label,
  onGhostAction
}: GhostPlaceholderProps): ReactElement {
  function handleClick(): void {
    if (onGhostAction) {
      onGhostAction({
        type: "missing-device-class",
        deviceClassId,
        cardTitle,
        placeholderLabel: label
      });
    }
  }

  return (
    <button
      type="button"
      className="flex h-full flex-col justify-between gap-3 rounded-xl border border-dashed border-border-base/60 bg-transparent p-4 text-left text-text-muted transition-colors hover:border-accent-primary/60 hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary"
      onClick={handleClick}
      aria-label={`${label} placeholder`}
      data-ghost-placeholder="true"
    >
      <div>
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        <p className="mt-1 text-sm">{description}</p>
      </div>
      <span className="inline-flex items-center gap-2 self-start rounded-full border border-accent-primary/40 bg-accent-primary/10 px-3 py-1 text-xs font-semibold text-accent-primary">
        {actionLabel}
      </span>
    </button>
  );
}
