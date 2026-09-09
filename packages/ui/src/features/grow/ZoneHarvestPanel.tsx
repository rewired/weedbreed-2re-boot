import { useState, type ReactElement } from "react";

import { refreshReadModels } from "@ui/state/readModels";
import type { ZoneReadModel } from "@ui/state/readModels.types";
import type { IntentClient } from "@ui/transport";

export interface ZoneHarvestPanelProps {
  readonly structureId: string;
  readonly roomId: string;
  readonly zone: ZoneReadModel;
  readonly intentClient: IntentClient | null;
  readonly onRefresh?: () => Promise<void>;
}

/** Presents only server-projected harvest readiness and submits a manual harvest intent. */
export function ZoneHarvestPanel({
  structureId,
  roomId,
  zone,
  intentClient,
  onRefresh = refreshReadModels
}: ZoneHarvestPanelProps): ReactElement | null {
  const eligibility = zone.harvestEligibility;
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if ((zone.plants?.length ?? 0) === 0 || !eligibility) return null;

  async function harvest(): Promise<void> {
    if (!intentClient || !eligibility?.eligible || isPending) return;
    setIsPending(true);
    setError(null);
    try {
      const result = await intentClient.submit(
        {
          type: "plants.harvest.v1",
          intentId: globalThis.crypto.randomUUID(),
          structureId,
          roomId,
          zoneId: zone.id,
          plantIds: [...eligibility.plantIds]
        },
        { onResult() { /* The acknowledgement gates the refresh below. */ } }
      );
      if (!result.ok) {
        setError(result.dictionary.description);
        return;
      }
      await onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ernte konnte nicht abgeschlossen werden.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section aria-labelledby="zone-harvest-heading" className="rounded-xl border border-border-base bg-canvas-raised p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="zone-harvest-heading" className="text-lg font-semibold">Manuelle Ernte</h2>
          <p className="mt-1 text-sm text-text-muted">Die Pflanzen bleiben bis zu deiner bestätigten Ernteentscheidung bestehen.</p>
        </div>
        <span className="rounded-full border border-border-base px-3 py-1 text-sm">
          {eligibility.plantIds.length} erntereif
        </span>
      </div>
      <ul aria-label="Erntebereitschaft der Pflanzen" className="mt-4 grid gap-2">
        {(zone.plants ?? []).map((plant) => (
          <li key={plant.id} className="flex items-center justify-between gap-3 rounded-lg border border-border-base p-3">
            <span><strong>{plant.strainName}</strong><br /><span className="text-xs text-text-muted">{plant.id}</span></span>
            <span>{plant.status === "harvested" ? "Geerntet" : plant.harvestReady ? "Erntereif" : "Noch nicht erntereif"}</span>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="mt-3 text-destructive">{error}</p> : null}
      <button
        type="button"
        disabled={!intentClient || !eligibility.eligible || isPending}
        onClick={() => { void harvest(); }}
        className="mt-4 rounded bg-accent-primary px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Ernte wird bestätigt…" : `Erntereife Pflanzen ernten (${eligibility.plantIds.length})`}
      </button>
      {!eligibility.eligible ? <p className="mt-2 text-sm text-text-muted">Noch keine aktive Pflanze ist erntereif.</p> : null}
    </section>
  );
}
