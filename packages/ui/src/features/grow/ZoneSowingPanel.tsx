import { useRef, useState, type ReactElement } from "react";
import type { ZoneReadModel } from "@ui/state/readModels.types";
import type { IntentClient } from "@ui/transport";
import { refreshReadModels } from "@ui/state/readModels";

export interface ZoneSowingPanelProps {
  readonly structureId: string;
  readonly roomId: string;
  readonly zone: ZoneReadModel;
  readonly intentClient: IntentClient | null;
  readonly onRefresh?: () => Promise<void>;
}

export function ZoneSowingPanel({
  structureId,
  roomId,
  zone,
  intentClient,
  onRefresh = refreshReadModels
}: ZoneSowingPanelProps): ReactElement {
  const choices = zone.strainChoices ?? [];
  const eligibility = zone.sowEligibility;
  const plants = zone.plants ?? [];
  const activePlants = plants.filter((plant) => plant.status !== "harvested");
  const [strainId, setStrainId] = useState(choices.find((choice) => choice.eligible)?.strainId ?? "");
  const [count, setCount] = useState(1);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intentId = useRef(globalThis.crypto.randomUUID());
  const selected = choices.find((choice) => choice.strainId === strainId);
  const validCount = !!eligibility && Number.isInteger(count) && count > 0 && count <= eligibility.capacityRemaining;

  async function sow(): Promise<void> {
    if (!intentClient || !eligibility?.eligible || !selected?.eligible || !validCount || isPending) return;
    setIsPending(true);
    setError(null);
    try {
      const result = await intentClient.submit(
        {
          type: "plants.sow.v1",
          intentId: intentId.current,
          structureId,
          roomId,
          zoneId: zone.id,
          strainId,
          count
        },
        { onResult() { /* The resolved acknowledgement gates the refresh below. */ } }
      );
      if (!result.ok) {
        setError(result.dictionary.description);
        return;
      }
      if (result.ack.ok) await onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aussaat konnte nicht abgeschlossen werden.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section aria-labelledby="zone-sowing-heading" className="rounded-xl border border-border-base bg-canvas-raised p-5">
      <h2 id="zone-sowing-heading" className="text-lg font-semibold">Anbau</h2>
      {activePlants.length > 0 ? (
        <ul className="mt-4 grid gap-3" aria-label="Pflanzenfortschritt">
          {activePlants.map((plant) => (
            <li key={plant.id} className="rounded-lg border border-border-base p-3">
              <strong>{plant.strainName}</strong>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><dt>Phase</dt><dd>{plant.phase}</dd></div>
                <div><dt>Alter</dt><dd>{plant.ageHours} h</dd></div>
                <div><dt>Gesundheit</dt><dd>{Math.round(plant.health01 * 100)}%</dd></div>
                <div><dt>Biomasse</dt><dd>{plant.biomassKg.toFixed(3)} kg</dd></div>
                <div><dt>Geschätzte Reife</dt><dd>Sim-Stunde {plant.estimatedMaturityAtSimHour}</dd></div>
                <div><dt>Verbleibend</dt><dd>{plant.estimatedRemainingHours} h</dd></div>
              </dl>
            </li>
          ))}
        </ul>
      ) : null}
      {activePlants.length === 0 && eligibility?.eligible ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            Sorte
            <select aria-label="Sorte" value={strainId} onChange={(event) => setStrainId(event.target.value)} disabled={isPending} className="mt-1 block w-full rounded border border-border-base p-2">
              {choices.map((choice) => <option key={choice.strainId} value={choice.strainId} disabled={!choice.eligible}>{choice.name}</option>)}
            </select>
          </label>
          <label className="block">
            Menge
            <input aria-label="Menge" type="number" min={1} max={eligibility.capacityRemaining} value={count} onChange={(event) => setCount(Number(event.target.value))} disabled={isPending} className="mt-1 block w-full rounded border border-border-base p-2" />
          </label>
          <p>Kapazität: {eligibility.capacityRemaining}</p>
          <p>Seedkosten: {((selected?.seedPriceCc ?? 0) * count).toFixed(2)} CC</p>
          <p className="text-xs text-text-muted">Buchung und Restsaldo folgen mit R-501.</p>
          {error ? <p role="alert" className="text-destructive">{error}</p> : null}
          <button type="button" disabled={!intentClient || !selected?.eligible || !validCount || isPending} onClick={() => { void sow(); }} className="rounded bg-accent-primary px-4 py-2 font-semibold text-white disabled:opacity-60">
            {isPending ? "Aussaat wird bestätigt…" : "Säen"}
          </button>
        </div>
      ) : null}
      {activePlants.length === 0 && eligibility && !eligibility.eligible ? (
        <p className="mt-3">Säen nicht möglich: {eligibility.reasons.join(", ")}</p>
      ) : null}
    </section>
  );
}
