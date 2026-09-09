import { useEffect, useState, type ReactElement } from "react";

import { refreshReadModels } from "@ui/state/readModels";
import type { EconomyReadModel, InventoryReadModel } from "@ui/state/readModels.types";
import type { IntentClient } from "@ui/transport";

export interface InventoryPanelProps {
  readonly inventory: InventoryReadModel;
  readonly economy?: EconomyReadModel;
  readonly sourceZoneId?: string;
  readonly intentClient?: IntentClient | null;
  readonly onRefresh?: () => Promise<void>;
}

function formatCc(value: number): string {
  return `${value.toFixed(2)} CC`;
}

/** Renders authoritative harvest lots and submits Ack-gated partial sale intents. */
export function InventoryPanel({ inventory, economy, sourceZoneId, intentClient = null, onRefresh = refreshReadModels }: InventoryPanelProps): ReactElement {
  const lots = sourceZoneId ? inventory.lots.filter((lot) => lot.source.zoneId === sourceZoneId) : inventory.lots;
  const [selectedLotId, setSelectedLotId] = useState(lots[0]?.lotId ?? "");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedLot = lots.find((lot) => lot.lotId === selectedLotId) ?? lots[0];
  const preview = selectedLot?.salePreview ?? null;

  useEffect(() => {
    if (!lots.some((lot) => lot.lotId === selectedLotId)) setSelectedLotId(lots[0]?.lotId ?? "");
  }, [lots, selectedLotId]);

  async function sellSelectedLot(): Promise<void> {
    if (!intentClient || !selectedLot || !preview || isPending) return;
    setIsPending(true);
    setError(null);
    try {
      const result = await intentClient.submit(
        { type: "inventory.sell.v1", intentId: globalThis.crypto.randomUUID(), lotId: selectedLot.lotId, fraction01: preview.fraction01 },
        { onResult() { /* The acknowledgement gates the refresh below. */ } }
      );
      if (!result.ok) {
        setError(result.dictionary.description);
        return;
      }
      await onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Der Verkauf konnte nicht abgeschlossen werden.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section aria-labelledby="inventory-heading" className="rounded-xl border border-border-base bg-canvas-raised p-5">
      <h2 id="inventory-heading" className="text-lg font-semibold">Inventar</h2>
      <p className="mt-1 text-sm text-text-muted">{sourceZoneId ? "Erntelots aus dieser Zone" : `Gesamtgewicht ${inventory.totalFreshWeightKg.toFixed(3)} kg`}</p>
      {lots.length === 0 ? <p className="mt-4">Noch keine Erntelots vorhanden.</p> : (
        <ul aria-label="Erntelots" className="mt-4 grid gap-3">
          {lots.map((lot) => (
            <li key={lot.lotId} className="rounded-lg border border-border-base p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><strong>{lot.strainName}</strong><span>Lot {lot.lotId}</span></div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div><dt>Frischgewicht verfügbar</dt><dd>{lot.remainingFreshWeightKg.toFixed(3)} kg</dd></div>
                <div><dt>Trockengewicht verfügbar</dt><dd>{lot.remainingDryWeightKg.toFixed(3)} kg</dd></div>
                <div><dt>Qualität</dt><dd>{Math.round(lot.quality01 * 100)}%</dd></div>
                <div><dt>Feuchte</dt><dd>{Math.round(lot.moisture01 * 100)}%</dd></div>
                <div><dt>Ernte-Tick</dt><dd>{lot.createdAtTick}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
      )}
      {lots.length > 0 ? (
        <section aria-labelledby="sale-heading" className="mt-5 rounded-lg border border-border-base p-4">
          <h3 id="sale-heading" className="font-semibold">50% Teilverkauf</h3>
          <label className="mt-3 grid gap-1 text-sm">Verkaufslot
            <select value={selectedLot?.lotId ?? ""} onChange={(event) => setSelectedLotId(event.target.value)} className="rounded border border-border-base bg-canvas-base px-3 py-2">
              {lots.map((lot) => <option key={lot.lotId} value={lot.lotId}>{lot.strainName} · {lot.lotId}</option>)}
            </select>
          </label>
          {preview ? (
            <dl aria-label="Verkaufsvorschau" className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><dt>Verkauft frisch</dt><dd>{preview.soldFreshWeightKg.toFixed(3)} kg</dd></div>
              <div><dt>Verkauft trocken</dt><dd>{preview.soldDryWeightKg.toFixed(3)} kg</dd></div>
              <div><dt>Quality-Faktor</dt><dd>{preview.qualityFactor.toFixed(3)}</dd></div>
              <div><dt>Sortenpreis</dt><dd>{preview.priceCcPerDryGram.toFixed(2)} CC/g</dd></div>
              <div><dt>Erlös</dt><dd>{formatCc(preview.proceedsCc)}</dd></div>
              <div><dt>Guthaben vorher</dt><dd>{formatCc(preview.balanceBeforeCc)}</dd></div>
              <div><dt>Guthaben nachher</dt><dd>{formatCc(preview.balanceAfterCc)}</dd></div>
              <div><dt>Zyklus-Deckungsbeitrag</dt><dd>{formatCc(preview.cycleContributionMarginAfterCc)}</dd></div>
            </dl>
          ) : <p className="mt-3 text-sm text-text-muted">Für dieses Lot ist kein Verkaufspreis verfügbar.</p>}
          {economy?.balanceCc !== null && economy?.balanceCc !== undefined ? <p className="mt-3 text-sm text-text-muted">Aktuelles Guthaben: {formatCc(economy.balanceCc)}</p> : null}
          {error ? <p role="alert" className="mt-3 text-destructive">{error}</p> : null}
          <button type="button" disabled={!intentClient || !preview || isPending} onClick={() => { void sellSelectedLot(); }} className="mt-4 rounded bg-accent-primary px-4 py-2 font-semibold text-white disabled:opacity-60">
            {isPending ? "Verkauf wird bestätigt…" : "50% verkaufen"}
          </button>
        </section>
      ) : null}
    </section>
  );
}
