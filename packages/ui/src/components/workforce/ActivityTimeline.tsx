import type { ReactElement } from "react";

export interface WorkforceActivityEntryView {
  readonly id: string;
  readonly timestampLabel: string;
  readonly title: string;
  readonly description: string;
  readonly scopeLabel: string;
  readonly assigneeLabel: string | null;
  readonly durationLabel: string;
}

export interface WorkforceActivityTimelineProps {
  readonly entries: readonly WorkforceActivityEntryView[];
}

export function WorkforceActivityTimeline({ entries }: WorkforceActivityTimelineProps): ReactElement {
  return (
    <section aria-labelledby="hr-activity-heading" className="space-y-4">
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">Activity</p>
        <h2 className="text-2xl font-semibold text-text-primary" id="hr-activity-heading">
          Recent HR activity timeline
        </h2>
        <p className="text-sm text-text-muted">
          Timeline of inspections, treatments, harvests, and maintenance tasks filtered by your HR criteria.
        </p>
      </header>

      <ol className="space-y-4" aria-label="HR activity timeline">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-xl border border-border-base bg-canvas-base/70 p-5"
            aria-label={entry.title}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-muted">
              <span className="font-semibold uppercase tracking-[0.2em] text-accent-muted">
                {entry.timestampLabel}
              </span>
              <span>{entry.durationLabel}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-text-primary">{entry.title}</h3>
            <p className="mt-1 text-sm text-text-muted">{entry.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-accent-muted">
              <span className="rounded-full border border-accent-muted/40 px-3 py-1 uppercase tracking-[0.2em]">
                {entry.scopeLabel}
              </span>
              {entry.assigneeLabel ? (
                <span className="rounded-full border border-accent-muted/40 px-3 py-1 uppercase tracking-[0.2em]">
                  {entry.assigneeLabel}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
