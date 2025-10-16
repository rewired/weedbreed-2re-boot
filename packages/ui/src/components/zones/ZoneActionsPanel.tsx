import type { ReactElement } from "react";
import { Settings2, Sprout } from "lucide-react";
import type { ZoneActionButton, ZoneDeviceControl } from "@ui/pages/zoneDetailHooks";

export interface ZoneActionsPanelProps {
  readonly actions: readonly ZoneActionButton[];
  readonly deviceControls: readonly ZoneDeviceControl[];
}

export function ZoneActionsPanel({ actions, deviceControls }: ZoneActionsPanelProps): ReactElement {
  return (
    <section className="space-y-4 rounded-xl border border-border-base bg-canvas-subtle/60 p-6" aria-labelledby="zone-actions-heading">
      <div className="flex items-center gap-2">
        <Sprout aria-hidden="true" className="size-5 text-accent-primary" />
        <h3 className="text-lg font-semibold text-text-primary" id="zone-actions-heading">
          Zone operations
        </h3>
      </div>
      <p className="text-sm text-text-muted">
        Intent buttons stay disabled until backend command flows wire up harvest, cull, and sow actions.
        Tooltips surface upcoming task references so operators know what is planned.
      </p>
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border-base bg-canvas-base px-4 py-2 text-sm font-medium text-text-primary"
            onClick={action.onSelect}
            disabled={action.disabled}
            title={action.disabledReason}
          >
            {action.label}
          </button>
        ))}
      </div>

      {deviceControls.length > 0 ? (
        <div className="space-y-3" aria-label="Device target controls">
          <div className="flex items-center gap-2">
            <Settings2 aria-hidden="true" className="size-4 text-accent-primary" />
            <h4 className="text-sm font-semibold text-text-primary">Device target adjustments</h4>
          </div>
          <p className="text-xs text-text-muted">
            Category-level device controls expose target adjustments. They remain read-only until the
            lighting and climate orchestration tasks ship.
          </p>
          <div className="flex flex-wrap gap-2">
            {deviceControls.map((control) => (
              <button
                key={control.id}
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-border-base bg-canvas-base px-3 py-1 text-xs font-medium text-text-primary"
                onClick={control.onSelect}
                disabled
                title={control.disabledReason}
              >
                {control.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

