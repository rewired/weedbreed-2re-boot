import type { ReactElement } from "react";
import { DoorOpen } from "lucide-react";
import type { RoomDetailHeader } from "@ui/pages/roomDetailHooks";
import { InlineRenameField } from "@ui/components/common/InlineRenameField";

export interface RoomHeaderProps {
  readonly header: RoomDetailHeader;
  readonly onRename: (nextName: string) => Promise<void>;
  readonly renameDisabledReason?: string;
}

export function RoomHeader({ header, onRename, renameDisabledReason }: RoomHeaderProps): ReactElement {
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
          <InlineRenameField
            name={header.roomName}
            label="Room name"
            renameLabel="Rename"
            disabledReason={renameDisabledReason}
            onSubmit={onRename}
          />
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

