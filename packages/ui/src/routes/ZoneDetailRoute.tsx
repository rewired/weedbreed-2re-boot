import type { ReactElement } from "react";
import { AlertTriangle } from "lucide-react";
import { useParams } from "react-router-dom";
import { ZoneDetailPage } from "@ui/pages/ZoneDetailPage";
import { resolveZoneByParams } from "@ui/lib/navigation";

export function ZoneDetailRoute(): ReactElement {
  const { structureId, zoneId } = useParams();
  const resolved = resolveZoneByParams(structureId, zoneId);

  if (!resolved) {
    return (
      <section className="flex flex-1 flex-col justify-center gap-4 text-center lg:text-left">
        <AlertTriangle className="mx-auto size-10 text-accent-muted lg:mx-0" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-text-primary">Zone not found</h2>
          <p className="text-sm text-text-muted">
            Select a zone from the navigation rail to inspect cultivation telemetry and readiness details.
          </p>
        </div>
      </section>
    );
  }

  const { structure, zone, room } = resolved;

  return <ZoneDetailPage structureId={structure.id} roomId={room?.id ?? null} zoneId={zone.id} />;
}
