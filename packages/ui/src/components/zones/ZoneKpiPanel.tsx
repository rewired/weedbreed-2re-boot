import type { ReactElement } from "react";
import { ActivitySquare } from "lucide-react";
import { Sparkline } from "@ui/components/charts/Sparkline";
import type { ZoneKpiAggregate, ZoneKpiOverview } from "@ui/pages/zoneDetailHooks";

export interface ZoneKpiPanelProps {
  readonly kpis: ZoneKpiOverview;
}

export function ZoneKpiPanel({ kpis }: ZoneKpiPanelProps): ReactElement {
  return (
    <section aria-labelledby="zone-kpi-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <ActivitySquare aria-hidden="true" className="size-5 text-accent-primary" />
        <h3 className="text-lg font-semibold text-text-primary" id="zone-kpi-heading">
          Plant health KPIs
        </h3>
      </div>
      <p className="text-sm text-text-muted">
        Aggregates summarise plant health, quality, and stress across the zone. Ranges show the
        24-hour min/median/max window, and sparklines track recent trends.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>
    </section>
  );
}

function MetricCard({ metric }: { readonly metric: ZoneKpiAggregate }): ReactElement {
  return (
    <article
      className="space-y-3 rounded-xl border border-border-base bg-canvas-subtle/60 p-4"
      aria-label={`${metric.label} metric`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">{metric.label}</h4>
        <span className="text-xs text-text-muted">Median {metric.median}{metric.unitLabel}</span>
      </header>
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1 text-xs text-text-muted">
          <p>
            Min <span className="font-medium text-text-primary">{metric.minimum}{metric.unitLabel}</span>
          </p>
          <p>
            Max <span className="font-medium text-text-primary">{metric.maximum}{metric.unitLabel}</span>
          </p>
        </div>
        <Sparkline
          data={metric.sparkline}
          min={metric.minimum}
          max={metric.maximum}
          title={`${metric.label} sparkline`}
        />
      </div>
    </article>
  );
}

