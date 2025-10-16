import type { ReactElement } from "react";
import { ThermometerSun } from "lucide-react";
import type { ZoneClimateSnapshot as ZoneClimateSnapshotData } from "@ui/pages/zoneDetailHooks";

export interface ZoneClimateSnapshotProps {
  readonly climate: ZoneClimateSnapshotData;
}

export function ZoneClimateSnapshot({ climate }: ZoneClimateSnapshotProps): ReactElement {
  return (
    <section aria-labelledby="zone-climate-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <ThermometerSun aria-hidden="true" className="size-5 text-accent-primary" />
        <h3 className="text-lg font-semibold text-text-primary" id="zone-climate-heading">
          Climate snapshot
        </h3>
      </div>
      <p className="text-sm text-text-muted">
        Zone telemetry mirrors SEC climate guidance with per-metric status flags. Targets represent
        cultivation-method baselines or configured ACH values.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {climate.metrics.map((metric) => (
          <article key={metric.id} className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4" aria-label={metric.label}>
            <header className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">{metric.label}</h4>
              <span className={`text-xs font-medium ${statusClass(metric.status)}`}>{metric.statusLabel}</span>
            </header>
            <p className="mt-3 text-lg font-semibold text-text-primary">{metric.measuredLabel}</p>
            <p className="text-xs text-text-muted">{metric.targetLabel}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function statusClass(status: "ok" | "warn" | "critical"): string {
  switch (status) {
    case "ok":
      return "text-accent-primary";
    case "warn":
      return "text-accent-warning";
    case "critical":
      return "text-accent-critical";
    default:
      return "text-text-muted";
  }
}

