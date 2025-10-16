import type { ReactElement } from "react";
import { Users2 } from "lucide-react";

export interface StructureWorkforceAssignmentSummary {
  readonly id: string;
  readonly employeeName: string;
  readonly role: string;
  readonly scopeLabel: string;
}

export interface StructureWorkforceSnapshotProps {
  readonly openTasks: number;
  readonly notes: string;
  readonly assignments: readonly StructureWorkforceAssignmentSummary[];
}

export function StructureWorkforceSnapshot({
  openTasks,
  notes,
  assignments
}: StructureWorkforceSnapshotProps): ReactElement {
  return (
    <section aria-labelledby="structure-workforce-heading" className="structure-workforce-card">
      <div className="flex items-center gap-2">
        <Users2 aria-hidden="true" className="size-5 text-accent-primary" />
        <h3 className="text-lg font-semibold text-text-primary" id="structure-workforce-heading">
          Workforce snapshot
        </h3>
      </div>
      <p className="mt-2 text-sm text-text-muted">
        Latest staffing focus for this structure. Assignments and backlog counts hydrate from the deterministic read-model
        fixture until live telemetry wiring lands.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-primary">
        <span className="rounded-full border border-border-base px-3 py-1 font-medium">
          Open tasks: {openTasks}
        </span>
        <span className="text-text-muted">{notes}</span>
      </div>
      <ul className="structure-workforce-card__list">
        {assignments.map((assignment) => (
          <li key={assignment.id} className="structure-workforce-card__assignment">
            <div>
              <p className="text-sm font-medium text-text-primary">{assignment.employeeName}</p>
              <p className="structure-workforce-card__assignment-meta">{assignment.role}</p>
            </div>
            <span className="structure-workforce-card__assignment-meta">{assignment.scopeLabel}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

