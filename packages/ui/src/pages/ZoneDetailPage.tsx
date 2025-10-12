import type { ReactElement } from "react";
import { AlertTriangle, GaugeCircle, Leaf, Sprout } from "lucide-react";
import { MetricCard } from "@ui/components/zones/MetricCard";
import {
  useZoneDetailSnapshot,
  type ZoneDetailMetadataOverrides,
  type ZoneDeviceCoverageSummary,
  type ZoneIntentPlaceholderAction
} from "@ui/pages/zoneDetailHooks";

export type ZoneDetailPageProps = ZoneDetailMetadataOverrides;

function renderCoverageBadge(status: ZoneDeviceCoverageSummary["status"]): string {
  switch (status) {
    case "ok":
      return "Stable";
    case "undersupplied":
      return "Undersupplied";
    default:
      return "Pending";
  }
}

export function ZoneDetailPage(props: ZoneDetailPageProps): ReactElement {
  const snapshot = useZoneDetailSnapshot(props);
  const { metadata, metrics, coverage, actions } = snapshot;

  return (
    <section aria-label={`Zone detail for ${metadata.zoneName}`} className="flex flex-1 flex-col gap-6">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">{metadata.structureName}</p>
        <div className="flex items-center gap-3">
          <Leaf aria-hidden="true" className="size-6 text-accent-primary" />
          <h2 className="text-3xl font-semibold text-text-primary">{metadata.zoneName}</h2>
        </div>
        <div className="flex flex-col gap-2 text-sm text-text-muted lg:flex-row lg:items-center lg:gap-4">
          <span>
            Cultivation method
            <span className="ml-2 font-medium text-text-primary">{metadata.cultivationMethodId}</span>
          </span>
          <span className="flex items-center gap-2">
            <Sprout aria-hidden="true" className="size-4 text-accent-primary" />
            <span className="font-medium text-text-primary">{metadata.cultivarName}</span>
            <span className="text-text-muted">· {metadata.currentStage} stage</span>
          </span>
          <span>
            Floor area
            <span className="ml-2 font-medium text-text-primary">{metadata.areaSquareMeters} m²</span>
          </span>
        </div>
      </header>

      <section aria-labelledby="zone-metrics-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <GaugeCircle aria-hidden="true" className="size-5 text-accent-primary" />
          <h3 className="text-lg font-semibold text-text-primary" id="zone-metrics-heading">
            Environmental metrics
          </h3>
        </div>
        <p className="text-sm text-text-muted">
          Placeholder telemetry summarising PPFD, DLI, temperature, humidity, CO₂, and ACH. Values render once Task 0031 feeds
          the store.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>
      </section>

      <section aria-labelledby="zone-coverage-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle aria-hidden="true" className="size-5 text-accent-primary" />
          <h3 className="text-lg font-semibold text-text-primary" id="zone-coverage-heading">
            Device coverage
          </h3>
        </div>
        <p className="text-sm text-text-muted">
          Coverage summaries will highlight undersupplied lighting, airflow, or irrigation devices once telemetry diagnostics
          bind in.
        </p>
        <ul className="grid gap-4 md:grid-cols-3">
          {coverage.map((item) => (
            <li key={item.id} className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">{item.title}</h4>
                <span className="text-xs font-medium text-accent-muted">{renderCoverageBadge(item.status)}</span>
              </div>
              <p className="mt-3 text-base font-medium text-text-primary">{item.coverageLabel}</p>
              <p className="mt-2 text-xs text-text-muted">{item.notes}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="zone-actions-heading" className="rounded-xl border border-border-base bg-canvas-subtle/60 p-6">
        <div className="flex items-center gap-2">
          <Leaf aria-hidden="true" className="size-5 text-accent-primary" />
          <h3 className="text-lg font-semibold text-text-primary" id="zone-actions-heading">
            Actions
          </h3>
        </div>
        <p className="mt-2 text-sm text-text-muted">
          Intent buttons stay disabled until the intent track wires command submission. Tooltips reference the follow-up tasks so
          operators know what is coming.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {actions.map((action: ZoneIntentPlaceholderAction) => (
            <button
              key={action.id}
              type="button"
              className="cursor-not-allowed rounded-lg border border-border-base bg-canvas-base px-4 py-2 text-sm font-medium text-text-muted"
              disabled
              title={action.disabledReason}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
