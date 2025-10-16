import type { ReactElement } from "react";
import { Wrench } from "lucide-react";
import type { ZoneDeviceGroup } from "@ui/pages/zoneDetailHooks";

export interface ZoneDevicesPanelProps {
  readonly groups: readonly ZoneDeviceGroup[];
}

export function ZoneDevicesPanel({ groups }: ZoneDevicesPanelProps): ReactElement {
  return (
    <section aria-labelledby="zone-devices-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <Wrench aria-hidden="true" className="size-5 text-accent-primary" />
        <h3 className="text-lg font-semibold text-text-primary" id="zone-devices-heading">
          Device coverage
        </h3>
      </div>
      <p className="text-sm text-text-muted">
        Devices are grouped by class with condition, contribution, and cap labels. Coverage warnings
        highlight undersupplied lighting, airflow, or irrigation capacity.
      </p>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4 text-sm text-text-muted">
          No devices assigned to this zone.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <article key={group.id} className="space-y-3 rounded-xl border border-border-base bg-canvas-subtle/60 p-4" aria-label={`${group.title} devices`}>
              <header className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-primary">{group.title}</h4>
                <span className="text-xs text-text-muted">{group.devices.length} devices</span>
              </header>
              {group.warnings.length > 0 ? (
                <ul className="space-y-1 rounded-lg border border-accent-warning/40 bg-accent-warning/5 p-3 text-xs text-accent-warning" aria-label={`${group.title} warnings`}>
                  {group.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              {group.controls.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {group.controls.map((control) => (
                    <button
                      key={control.id}
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-border-base bg-canvas-base px-3 py-1 text-xs font-medium text-text-primary"
                      disabled
                      title={control.disabledReason}
                    >
                      {control.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <ul className="space-y-3" aria-label={`${group.title} device list`}>
                {group.devices.map((device) => (
                  <li key={device.id} className="rounded-lg border border-border-base bg-canvas-base p-3 text-sm text-text-muted">
                    <p className="font-medium text-text-primary">{device.name}</p>
                    <p>{device.conditionLabel}</p>
                    <p>{device.contributionLabel}</p>
                    <p className="text-xs">{device.capLabel}</p>
                    {device.warnings.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-accent-warning">
                        {device.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    ) : null}
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

