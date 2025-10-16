import type { ReactElement } from "react";
import { Leaf } from "lucide-react";
import type { ZoneBadge, ZoneHeaderSnapshot } from "@ui/pages/zoneDetailHooks";
import { InlineRenameField } from "@ui/components/common/InlineRenameField";

export interface ZoneHeaderProps {
  readonly header: ZoneHeaderSnapshot;
  readonly onRename: (nextName: string) => Promise<void>;
  readonly renameDisabledReason?: string;
}

export function ZoneHeader({ header, onRename, renameDisabledReason }: ZoneHeaderProps): ReactElement {
  return (
    <header className="space-y-4" aria-label={`Zone header for ${header.zoneName}`}>
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">{header.structureName}</p>
        <div className="flex items-center gap-3">
          <Leaf aria-hidden="true" className="size-6 text-accent-primary" />
          <InlineRenameField
            name={header.zoneName}
            label="Zone name"
            renameLabel="Rename"
            disabledReason={renameDisabledReason}
            onSubmit={onRename}
          />
        </div>
        <p className="text-sm text-text-muted">
          {header.cultivarLabel} · {header.stageLabel} stage
        </p>
      </div>

      <div className="flex flex-wrap gap-3" aria-label="Zone badges">
        {header.badges.map((badge) => (
          <ZoneBadgePill key={badge.id} badge={badge} />
        ))}
      </div>

      <ul className="space-y-1 text-sm text-text-muted" aria-label="Zone cultivation hints">
          {header.hints.map((hint, index) => (
            <li key={`${header.zoneName}-hint-${index.toString()}`}>{hint}</li>
          ))}
      </ul>
    </header>
  );
}

function ZoneBadgePill({ badge }: { readonly badge: ZoneBadge }): ReactElement {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border-base bg-canvas-subtle px-3 py-1 text-xs font-medium text-text-primary">
      <span className="uppercase tracking-[0.2em] text-accent-muted">{badge.description}</span>
      <span>{badge.label}</span>
    </span>
  );
}

