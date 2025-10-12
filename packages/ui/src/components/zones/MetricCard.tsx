import type { ReactElement } from "react";
import type { ZoneTelemetryMetric } from "@ui/pages/zoneDetailHooks";

export interface MetricCardProps {
  readonly metric: ZoneTelemetryMetric;
}

export function MetricCard({ metric }: MetricCardProps): ReactElement {
  const { id, label, unitLabel, formattedValue, description, isAvailable, unavailableReason } = metric;
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <section
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4 shadow-sm"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h3 id={titleId} className="text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">
          {label}
        </h3>
        <span className="text-xs text-text-muted">{unitLabel}</span>
      </header>
      <p className="mt-4 text-3xl font-semibold text-text-primary" aria-live="polite">
        {isAvailable ? formattedValue : "—"}
      </p>
      <p id={descriptionId} className="mt-2 text-xs text-text-muted">
        {isAvailable ? description : unavailableReason}
      </p>
    </section>
  );
}
