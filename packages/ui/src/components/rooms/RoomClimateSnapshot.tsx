import type { ReactElement } from "react";
import { GaugeCircle } from "lucide-react";
import type { RoomClimateOverview } from "@ui/pages/roomDetailHooks";

export interface RoomClimateSnapshotProps {
  readonly climate: RoomClimateOverview;
}

export function RoomClimateSnapshot({ climate }: RoomClimateSnapshotProps): ReactElement {
  return (
    <section aria-labelledby="room-climate-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <GaugeCircle aria-hidden="true" className="size-5 text-accent-primary" />
        <h3 className="text-lg font-semibold text-text-primary" id="room-climate-heading">
          Climate & airflow snapshot
        </h3>
      </div>
      <p className="text-sm text-text-muted">
        Baselines compare target environmental conditions against current readings. Status badges indicate whether telemetry is
        within acceptable tolerances per SEC airflow and climate guidance.
      </p>
      {climate.notes ? <p className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4 text-sm text-text-muted">{climate.notes}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {climate.metrics.map((metric) => (
          <article key={metric.id} className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4" aria-label={metric.label}>
            <header className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">{metric.label}</h4>
              <span
                className={`text-xs font-medium ${metric.status === "ok" ? "text-accent-primary" : "text-accent-critical"}`}
              >
                {metric.statusLabel}
              </span>
            </header>
            <p className="mt-3 text-lg font-semibold text-text-primary">{metric.measuredLabel}</p>
            <p className="text-xs text-text-muted">{metric.targetLabel}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

