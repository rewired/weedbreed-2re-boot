import type { ReactElement } from "react";
import { AlertTriangle, Leaf } from "lucide-react";
import { useParams } from "react-router-dom";
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

  const { structure, zone } = resolved;

  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.25em] text-accent-muted">{structure.name}</p>
        <div className="flex items-center gap-3">
          <Leaf aria-hidden="true" className="size-6 text-accent-primary" />
          <h2 className="text-3xl font-semibold text-text-primary">{zone.name}</h2>
        </div>
        <p className="text-sm text-text-muted">
          Cultivation method <span className="font-medium text-text-primary">{zone.cultivationMethod}</span> · Telemetry surface coming soon.
        </p>
      </header>
      <div className="rounded-xl border border-border-base bg-canvas-subtle/60 p-6 text-sm text-text-muted">
        This placeholder preserves routing while downstream tasks hydrate the zone detail view with environment, labour, and
        diagnostics read-models.
      </div>
    </section>
  );
}
