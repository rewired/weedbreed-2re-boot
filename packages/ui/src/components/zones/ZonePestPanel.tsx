import type { ReactElement } from "react";
import { Bug, Info } from "lucide-react";
import type { ZonePestStatusSnapshot } from "@ui/pages/zoneDetailHooks";

export interface ZonePestPanelProps {
  readonly pest: ZonePestStatusSnapshot;
}

export function ZonePestPanel({ pest }: ZonePestPanelProps): ReactElement {
  return (
    <section aria-labelledby="zone-pest-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <Bug aria-hidden="true" className="size-5 text-accent-primary" />
        <h3 className="text-lg font-semibold text-text-primary" id="zone-pest-heading">
          Pest & disease readiness
        </h3>
      </div>
      <p className="text-sm text-text-muted">
        Counts reflect active incidents, overdue inspections, and treatment cooldown windows. Timestamps
        convert tick counters into day/hour labels for operators.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="space-y-3 rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
          <header className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">Status</h4>
            <span className="text-xs text-text-muted">Inspection cadence</span>
          </header>
          <ul className="grid grid-cols-3 gap-3 text-sm text-text-muted" aria-label="Pest counts">
            <li>
              <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Active</p>
              <p className="text-lg font-semibold text-text-primary">{pest.counts.activeIssues}</p>
            </li>
            <li>
              <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Inspections due</p>
              <p className="text-lg font-semibold text-text-primary">{pest.counts.dueInspections}</p>
            </li>
            <li>
              <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Cooldown</p>
              <p className="text-lg font-semibold text-text-primary">{pest.counts.cooldowns}</p>
            </li>
          </ul>
          <dl className="space-y-1 text-xs text-text-muted">
            <div className="flex items-center justify-between gap-2">
              <dt>Last inspection</dt>
              <dd className="font-medium text-text-primary">{pest.lastInspectionLabel}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt>Next inspection</dt>
              <dd className="font-medium text-text-primary">{pest.nextInspectionLabel}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt>Last treatment</dt>
              <dd className="font-medium text-text-primary">{pest.lastTreatmentLabel}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt>Next treatment</dt>
              <dd className="font-medium text-text-primary">{pest.nextTreatmentLabel}</dd>
            </div>
          </dl>
        </article>

        <article className="space-y-3 rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
          <header className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">Zone context</h4>
            <Info aria-hidden="true" className="size-4 text-accent-primary" />
          </header>
          <dl className="space-y-2 text-sm text-text-muted">
            <ContextRow label="Area" value={pest.context.areaLabel} />
            <ContextRow label="Volume" value={pest.context.volumeLabel} />
            <ContextRow label="Plant capacity" value={pest.context.plantCapacityLabel} />
            <ContextRow label="Free plants" value={pest.context.freePlantLabel} />
            <ContextRow label="Density" value={pest.context.densityLabel} />
            {pest.context.roomFreeAreaLabel ? (
              <ContextRow label="Room free area" value={pest.context.roomFreeAreaLabel} />
            ) : null}
            {pest.context.roomFreeVolumeLabel ? (
              <ContextRow label="Room free volume" value={pest.context.roomFreeVolumeLabel} />
            ) : null}
          </dl>
        </article>
      </div>

      <article className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4" aria-label="Pest timeline">
        <header className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">Recent activity</h4>
          <span className="text-xs text-text-muted">Last four events</span>
        </header>
        {pest.timeline.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No recent inspections or treatments recorded.</p>
        ) : (
          <ol className="mt-3 space-y-3 text-sm text-text-muted">
            {pest.timeline.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 rounded-lg border border-border-base bg-canvas-base p-3">
                <p className="font-medium text-text-primary">{item.title}</p>
                <p className="text-xs text-text-muted">{item.timestampLabel}</p>
                <span className="text-xs uppercase tracking-[0.2em] text-accent-muted">{item.statusLabel}</span>
              </li>
            ))}
          </ol>
        )}
      </article>
    </section>
  );
}

function ContextRow({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-xs uppercase tracking-[0.2em] text-accent-muted">{label}</dt>
      <dd className="font-medium text-text-primary">{value}</dd>
    </div>
  );
}

