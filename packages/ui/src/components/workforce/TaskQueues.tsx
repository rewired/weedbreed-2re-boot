import { useId, useState, type ReactElement } from "react";

export interface WorkforceAssigneeOption {
  readonly id: string;
  readonly label: string;
}

export interface WorkforceTaskQueueEntryAction {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}

export interface WorkforceTaskQueueEntryView {
  readonly id: string;
  readonly typeLabel: string;
  readonly statusLabel: string;
  readonly scopeLabel: string;
  readonly dueLabel: string;
  readonly assigneeId: string | null;
  readonly assigneeName: string | null;
  readonly assignable: boolean;
  readonly onAssign: (assigneeId: string | null) => void;
  readonly actions: readonly WorkforceTaskQueueEntryAction[];
}

export interface WorkforceTaskQueueView {
  readonly id: string;
  readonly title: string;
  readonly entries: readonly WorkforceTaskQueueEntryView[];
}

export interface WorkforceTaskQueuesProps {
  readonly queues: readonly WorkforceTaskQueueView[];
  readonly assignees: readonly WorkforceAssigneeOption[];
}

export function WorkforceTaskQueues({ queues, assignees }: WorkforceTaskQueuesProps): ReactElement {
  return (
    <section aria-labelledby="hr-task-queues-heading" className="space-y-4">
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">Task queues</p>
        <h2 className="text-2xl font-semibold text-text-primary" id="hr-task-queues-heading">
          Upcoming and in-progress tasks
        </h2>
        <p className="text-sm text-text-muted">
          Read-only queues mirror zone and room surfaces. Assign team members or trigger intents when you have
          permissions.
        </p>
      </header>

      <div className="space-y-4">
        {queues.map((queue) => (
          <article
            key={queue.id}
            aria-label={`${queue.title} tasks`}
            className="space-y-3 rounded-xl border border-border-base bg-canvas-base/60 p-5"
          >
            <header className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">{queue.title}</h3>
            </header>
            <ul className="space-y-3" aria-label={`${queue.title} tasks`}>
              {queue.entries.map((entry) => (
                <TaskQueueEntry
                  key={entry.id}
                  entry={entry}
                  assignees={assignees}
                />
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

interface TaskQueueEntryProps {
  readonly entry: WorkforceTaskQueueEntryView;
  readonly assignees: readonly WorkforceAssigneeOption[];
}

function TaskQueueEntry({ entry, assignees }: TaskQueueEntryProps): ReactElement {
  const selectId = useId();
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>(entry.assigneeId ?? "");
  const assignButtonLabel = entry.assigneeId ? "Reassign" : "Assign";
  const hasAssignees = assignees.length > 0;
  const canAssign = entry.assignable && hasAssignees && selectedAssigneeId.length > 0;

  return (
    <li className="space-y-3 rounded-lg border border-border-base/60 bg-canvas-raised/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-muted">
        <span className="font-semibold uppercase tracking-[0.2em] text-accent-muted">{entry.typeLabel}</span>
        <span>{entry.statusLabel}</span>
      </div>
      <div className="flex flex-col gap-1 text-sm text-text-primary">
        <p>{entry.scopeLabel}</p>
        <p className="text-xs text-text-muted">Due {entry.dueLabel}</p>
        {entry.assigneeName ? (
          <p className="text-xs text-text-muted">Assigned to {entry.assigneeName}</p>
        ) : (
          <p className="text-xs text-text-muted">Unassigned</p>
        )}
      </div>

      {entry.assignable ? (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-muted" htmlFor={selectId}>
            Select assignee
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              id={selectId}
              className="min-w-[12rem] flex-1 rounded-lg border border-border-base bg-canvas-base px-3 py-2 text-sm text-text-primary"
              value={selectedAssigneeId}
              onChange={(event) => {
                setSelectedAssigneeId(event.currentTarget.value);
              }}
            >
              <option value="">Unassigned</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-lg border border-accent-primary/70 bg-accent-primary/20 px-3 py-2 text-sm font-semibold text-accent-primary disabled:opacity-60"
              onClick={() => {
                entry.onAssign(selectedAssigneeId === "" ? null : selectedAssigneeId);
              }}
              disabled={!canAssign}
              aria-disabled={!canAssign}
            >
              {assignButtonLabel}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {entry.actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className="rounded-lg border border-border-base/70 bg-canvas-base px-3 py-2 text-sm text-text-primary transition hover:border-accent-primary hover:text-accent-primary"
            onClick={action.onClick}
            disabled={action.disabled}
            aria-disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
      </div>
    </li>
  );
}
