import type { ReactElement } from "react";
import { AlertTriangle, Gauge, Zap } from "lucide-react";

export type StructureCapacityStatus = "ok" | "warn";

export interface StructureCapacityTile {
  readonly id: string;
  readonly title: string;
  readonly metricLabel: string;
  readonly secondaryLabel: string;
  readonly status: StructureCapacityStatus;
  readonly note: string;
  readonly warnings: readonly string[];
}

export interface StructureCapacityGridProps {
  readonly tiles: readonly StructureCapacityTile[];
}

function resolveStatusIcon(status: StructureCapacityStatus): ReactElement {
  switch (status) {
    case "warn":
      return <AlertTriangle aria-hidden="true" className="size-4" />;
    default:
      return <Gauge aria-hidden="true" className="size-4" />;
  }
}

function resolvePowerIcon(tileId: string): ReactElement | null {
  if (tileId !== "structure-capacity-power") {
    return null;
  }

  return <Zap aria-hidden="true" className="size-4 text-accent-primary" />;
}

export function StructureCapacityGrid({ tiles }: StructureCapacityGridProps): ReactElement {
  return (
    <section aria-labelledby="structure-capacity-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <Gauge aria-hidden="true" className="size-5 text-accent-primary" />
        <h3 className="text-lg font-semibold text-text-primary" id="structure-capacity-heading">
          Capacity & coverage
        </h3>
      </div>
      <p className="text-sm text-text-muted">
        Lighting, HVAC, and electrical draw summaries reference the structure read-model coverage snapshot. Warnings
        highlight undersupplied interfaces so Task 7000/8000 flows can prioritise remediation.
      </p>
      <div className="structure-capacity-grid">
        {tiles.map((tile) => (
          <article
            key={tile.id}
            className="structure-capacity-card"
            data-status={tile.status}
            aria-label={`${tile.title} summary`}
          >
            <header className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {resolvePowerIcon(tile.id)}
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">{tile.title}</h4>
              </div>
              <span className="structure-capacity-card__status" data-status={tile.status}>
                {resolveStatusIcon(tile.status)}
                <span>{tile.status === "ok" ? "Stable" : "Needs attention"}</span>
              </span>
            </header>
            <p className="structure-capacity-card__metric">{tile.metricLabel}</p>
            <p className="structure-capacity-card__meta">{tile.secondaryLabel}</p>
            <p className="text-xs text-text-muted">{tile.note}</p>
            {tile.warnings.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-accent-critical">
                {tile.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

