import type { ReactElement } from "react";
import { AlertTriangle, CheckCircle2, Sprout } from "lucide-react";
import { Link, useInRouterContext } from "react-router-dom";
import type { RoomZoneListItem } from "@ui/pages/roomDetailHooks";

export interface RoomZonesListProps {
  readonly zones: readonly RoomZoneListItem[];
}

export function RoomZonesList({ zones }: RoomZonesListProps): ReactElement {
  const hasRouterContext = useInRouterContext();

  return (
    <section aria-labelledby="room-zones-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <Sprout aria-hidden="true" className="size-5 text-accent-primary" />
        <h3 className="text-lg font-semibold text-text-primary" id="room-zones-heading">
          Zones snapshot
        </h3>
      </div>
      <p className="text-sm text-text-muted">
        Health and readiness indicators highlight pest issues, harvest readiness, and device warnings for each zone within the
        room.
      </p>
      {zones.length === 0 ? (
        <p className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4 text-sm text-text-muted">
          No zones assigned yet. Use the action buttons below to create or duplicate a zone when the orchestration ships.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {zones.map((zone) => (
            <li key={zone.id} className="rounded-xl border border-border-base bg-canvas-subtle/60 p-4">
              <div className="flex items-center justify-between gap-3">
                {hasRouterContext ? (
                  <Link
                    to={zone.link}
                    className="text-lg font-semibold text-text-primary transition hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-raised"
                  >
                    {zone.name}
                  </Link>
                ) : (
                  <span className="text-lg font-semibold text-text-primary">{zone.name}</span>
                )}
                {zone.readyToHarvest ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-primary/10 px-3 py-1 text-xs font-medium text-accent-primary">
                    <CheckCircle2 aria-hidden="true" className="size-3" /> Ready to harvest
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-text-muted">
                Health: <span className="font-medium text-text-primary">{zone.healthPercent}%</span> · Quality:
                <span className="ml-1 font-medium text-text-primary">{zone.qualityPercent}%</span>
              </p>
              {zone.pestBadges.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2 text-xs text-accent-critical" aria-label="Pest indicators">
                  {zone.pestBadges.map((badge) => (
                    <li key={badge} className="inline-flex items-center gap-1 rounded-full bg-accent-critical/10 px-3 py-1">
                      <AlertTriangle aria-hidden="true" className="size-3" /> {badge}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-text-muted">No active pest issues detected.</p>
              )}
              {zone.deviceWarnings.length > 0 ? (
                <div className="mt-3 space-y-1" aria-label="Device warnings">
                  {zone.deviceWarnings.map((warning) => (
                    <p key={warning} className="text-xs text-accent-critical">
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

