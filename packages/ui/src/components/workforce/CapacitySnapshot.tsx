import type { ReactElement } from "react";

export interface WorkforceCapacityEntryView {
  readonly role: string;
  readonly headcount: number;
  readonly queuedTasks: number;
  readonly coverageStatus: "ok" | "warn" | "critical";
  readonly coverageHint: string;
}

export interface WorkforceCapacitySnapshotProps {
  readonly entries: readonly WorkforceCapacityEntryView[];
}

function resolveStatusClass(status: WorkforceCapacityEntryView["coverageStatus"]): string {
  switch (status) {
    case "ok":
      return "border-accent-primary/40 text-accent-primary";
    case "warn":
      return "border-accent-warning/60 text-accent-warning";
    case "critical":
      return "border-destructive/60 text-destructive";
    default:
      return "border-border-base text-text-primary";
  }
}

export function WorkforceCapacitySnapshot({ entries }: WorkforceCapacitySnapshotProps): ReactElement {
  return (
    <section aria-labelledby="hr-capacity-heading" className="space-y-4">
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">Capacity</p>
        <h2 className="text-2xl font-semibold text-text-primary" id="hr-capacity-heading">
          Capacity coverage snapshot
        </h2>
        <p className="text-sm text-text-muted">
          Headcount compared to open tasks for each role. Coverage hints surface pressure points.
        </p>
      </header>

      <ul className="grid gap-3 md:grid-cols-2" aria-label="HR capacity snapshot">
        {entries.map((entry) => (
          <li key={entry.role} className="rounded-xl border border-border-base bg-canvas-base/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-text-primary">{entry.role}</p>
                <p className="text-sm text-text-muted">Headcount {entry.headcount}</p>
                <p className="text-sm text-text-muted">Queued tasks {entry.queuedTasks}</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${resolveStatusClass(entry.coverageStatus)}`}
              >
                {entry.coverageStatus.toUpperCase()}
              </span>
            </div>
            <p className="mt-3 text-sm text-text-muted">{entry.coverageHint}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
