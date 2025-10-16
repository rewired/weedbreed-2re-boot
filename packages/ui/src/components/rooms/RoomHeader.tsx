import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { DoorOpen, Pencil, X } from "lucide-react";
import type { RoomDetailHeader } from "@ui/pages/roomDetailHooks";

export interface RoomHeaderProps {
  readonly header: RoomDetailHeader;
  readonly onRename: (nextName: string) => void;
  readonly renameDisabledReason?: string;
}

export function RoomHeader({ header, onRename, renameDisabledReason }: RoomHeaderProps): ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(header.roomName);

  useEffect(() => {
    setDraftName(header.roomName);
    setIsEditing(false);
  }, [header.roomName]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed) {
      return;
    }

    onRename(trimmed);
    setIsEditing(false);
  }

  const achTarget = header.achTarget;
  const achCurrent = header.achCurrent;
  const achPercent = achTarget > 0 ? Math.min(100, Math.round((achCurrent / achTarget) * 100)) : 0;
  const achStatus = achCurrent >= achTarget ? "ok" : "warn";

  return (
    <header className="space-y-4">
      <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">{header.structureName}</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <DoorOpen aria-hidden="true" className="size-6 text-accent-primary" />
          <form onSubmit={handleSubmit} className="flex items-center gap-2" aria-label="Rename room">
            <label htmlFor="room-name-input" className="sr-only">
              Room name
            </label>
            <input
              id="room-name-input"
              className="rounded-lg border border-border-base bg-canvas-base px-3 py-1 text-3xl font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
              value={draftName}
              onChange={(event) => {
                setDraftName(event.target.value);
              }}
              readOnly={!isEditing}
              aria-disabled={!isEditing}
            />
            {isEditing ? (
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg border border-accent-primary/60 bg-accent-primary/10 px-3 py-1 text-sm font-medium text-text-primary transition hover:border-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
                >
                  Save
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-border-base bg-canvas-base px-3 py-1 text-sm text-text-muted transition hover:border-border-strong hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
                  onClick={() => {
                    setIsEditing(false);
                    setDraftName(header.roomName);
                  }}
                >
                  <X aria-hidden="true" className="size-4" />
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-border-base bg-canvas-base px-3 py-1 text-sm font-medium text-text-primary transition hover:border-accent-primary/40 hover:bg-canvas-subtle/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
                onClick={() => {
                  setIsEditing(true);
                }}
                title={renameDisabledReason}
              >
                <Pencil aria-hidden="true" className="size-4" />
                Rename
              </button>
            )}
          </form>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Purpose</p>
          <p className="text-lg font-semibold text-text-primary">{header.purposeLabel}</p>
        </div>
        <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Floor area</p>
          <p className="text-lg font-semibold text-text-primary">{header.areaUsedLabel}</p>
          <p className="text-xs text-text-muted">Free: {header.areaFreeLabel}</p>
        </div>
        <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Volume</p>
          <p className="text-lg font-semibold text-text-primary">{header.volumeUsedLabel}</p>
          <p className="text-xs text-text-muted">Free: {header.volumeFreeLabel}</p>
        </div>
        <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4 space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Baseline ACH</p>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-text-primary">{achCurrent.toFixed(1)} ACH</span>
            <span className="text-xs text-text-muted">Target {achTarget.toFixed(1)} ACH</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-border-base/40" role="presentation">
            <div
              className={`h-full rounded-full ${achStatus === "ok" ? "bg-accent-primary" : "bg-accent-critical/80"}`}
              style={{ width: `${achPercent.toFixed(0)}%` }}
              role="progressbar"
              aria-valuenow={Math.round(achCurrent)}
              aria-valuemin={0}
              aria-valuemax={Math.round(achTarget)}
              aria-label="Air changes per hour vs target"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

