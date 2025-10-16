import type { ReactElement } from "react";
import { Clock } from "lucide-react";
import type { RoomAction, RoomTimelineItem } from "@ui/pages/roomDetailHooks";

export interface RoomTimelinePanelProps {
  readonly timeline: readonly RoomTimelineItem[];
  readonly actions: readonly RoomAction[];
}

export function RoomTimelinePanel({ timeline, actions }: RoomTimelinePanelProps): ReactElement {
  return (
    <section aria-labelledby="room-timeline-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock aria-hidden="true" className="size-5 text-accent-primary" />
        <h3 className="text-lg font-semibold text-text-primary" id="room-timeline-heading">
          Room activity & actions
        </h3>
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">Recent activity</h4>
          {timeline.length === 0 ? (
            <p className="mt-3 rounded-xl border border-border-base bg-canvas-subtle/60 p-4 text-sm text-text-muted">
              No timeline entries yet for this room.
            </p>
          ) : (
            <ol className="mt-3 space-y-3">
              {timeline.map((entry) => (
                <li key={entry.id} className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-text-primary">{entry.title}</p>
                    <span className="text-xs text-text-muted">{entry.timestampLabel}</span>
                  </div>
                  <p className="mt-1 text-xs text-accent-muted uppercase tracking-[0.2em]">{entry.statusLabel}</p>
                  <p className="mt-2 text-sm text-text-muted">{entry.description}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">Actions</h4>
          <p className="text-xs text-text-muted">
            Buttons trigger console stubs until Task 7000/8000 wire the orchestration flows.
          </p>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-border-base bg-canvas-subtle px-3 py-2 text-xs font-medium text-text-primary transition hover:border-accent-primary/40 hover:bg-canvas-subtle/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
                onClick={action.onSelect}
                title={action.disabledReason}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

