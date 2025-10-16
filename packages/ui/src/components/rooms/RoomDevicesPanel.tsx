import type { ReactElement } from "react";
import { Wrench } from "lucide-react";
import type { RoomDeviceGroup } from "@ui/pages/roomDetailHooks";

export interface RoomDevicesPanelProps {
  readonly groups: readonly RoomDeviceGroup[];
}

export function RoomDevicesPanel({ groups }: RoomDevicesPanelProps): ReactElement {
  return (
    <section aria-labelledby="room-devices-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <Wrench aria-hidden="true" className="size-5 text-accent-primary" />
        <h3 className="text-lg font-semibold text-text-primary" id="room-devices-heading">
          Device allocations
        </h3>
      </div>
      <p className="text-sm text-text-muted">
        Devices are grouped by class with condition, contribution, and eligibility labels. Move, remove, and replace flows are
        stubbed pending Task 8000-series orchestration.
      </p>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4 text-sm text-text-muted">
          No devices attached to this room yet.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <article key={group.id} className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4" aria-label={`${group.title} devices`}>
              <header className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">{group.title}</h4>
                <span className="text-xs text-text-muted">{group.devices.length} devices</span>
              </header>
              <ul className="mt-4 space-y-3">
                {group.devices.map((device) => (
                  <li key={device.id} className="rounded-lg border border-border-base bg-canvas-base p-3">
                    <div className="flex flex-col gap-1 text-sm">
                      <span className="text-text-primary font-medium">{device.name}</span>
                      <span className="text-text-muted">{device.conditionLabel}</span>
                      <span className="text-text-muted">{device.contributionLabel}</span>
                      <span className="text-xs text-text-muted">{device.eligibilityLabel}</span>
                      {device.warnings.length > 0 ? (
                        <div className="mt-2 space-y-1 text-xs text-accent-critical">
                          {device.warnings.map((warning) => (
                            <p key={warning}>{warning}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {device.actions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          className="inline-flex items-center gap-2 rounded-lg border border-border-base bg-canvas-subtle px-3 py-1 text-xs font-medium text-text-primary transition hover:border-accent-primary/40 hover:bg-canvas-subtle/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
                          onClick={action.onSelect}
                          title={action.disabledReason}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

