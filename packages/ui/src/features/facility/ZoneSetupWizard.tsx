import { useMemo, useRef, useState, type ReactElement } from "react";
import type { CompatibilityMaps, PriceBookCatalog, ZoneReadModel } from "@ui/state/readModels.types";
import type { IntentClient } from "@ui/transport";
import { refreshReadModels } from "@ui/state/readModels";
import { buildZoneSetupPlan } from "./zoneSetupPlan";

export interface ZoneSetupWizardProps {
  readonly structureId: string;
  readonly roomId: string;
  readonly zone: ZoneReadModel;
  readonly priceBook: PriceBookCatalog;
  readonly compatibility: CompatibilityMaps;
  readonly intentClient: IntentClient | null;
  readonly onRefresh?: () => Promise<void>;
}

export function ZoneSetupWizard({ structureId, roomId, zone, priceBook, compatibility, intentClient, onRefresh = refreshReadModels }: ZoneSetupWizardProps): ReactElement {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intentIds = useRef(new Map<string, string>());
  const plan = useMemo(() => buildZoneSetupPlan(zone, priceBook), [zone, priceBook]);
  const readiness = zone.readiness;
  const configurationFailures = new Set(["cultivation-method", "container", "substrate", "irrigation", "cultivation-compatibility"]);
  const hasConfigurationFailure = readiness?.missingPrerequisites.some((item) => configurationFailures.has(item)) ?? false;
  const compatibilityStatus = readiness
    ? hasConfigurationFailure ? "block" : "ok"
    : compatibility.cultivationToIrrigation[zone.cultivationMethodId]?.[zone.irrigationMethodId] ?? "block";

  async function submitSetup(): Promise<void> {
    if (!intentClient || isPending || !plan.isPriced || compatibilityStatus === "block") return;
    setIsPending(true);
    setError(null);
    try {
      for (const line of plan.lines) {
        const installedCount = zone.devices.filter((device) => device.slug === line.slug).length;
        for (let index = 0; index < line.quantity; index += 1) {
          const intentKey = `${line.blueprintId}:${String(installedCount + index)}`;
          const intentId = intentIds.current.get(intentKey) ?? globalThis.crypto.randomUUID();
          intentIds.current.set(intentKey, intentId);
          const result = await intentClient.submit({ type: "device.purchaseInstall.v1", intentId, structureId, roomId, zoneId: zone.id, deviceBlueprintId: line.blueprintId }, { onResult() { /* Resolved acknowledgement gates the next purchase. */ } });
          if (!result.ok) {
            setError(result.dictionary.description);
            return;
          }
          if (!result.ack.ok) {
            setError("Installation wurde nicht bestätigt.");
            return;
          }
        }
      }
      await onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Zone-Setup konnte nicht abgeschlossen werden.");
    } finally {
      setIsPending(false);
    }
  }

  const canSubmit = !!intentClient && plan.isPriced && compatibilityStatus !== "block" && plan.lines.some((line) => line.quantity > 0);

  return (
    <section aria-labelledby="zone-setup-heading" className="rounded-xl border border-border-base bg-canvas-raised p-5">
      <h2 id="zone-setup-heading" className="text-lg font-semibold text-text-primary">Zone startklar machen</h2>
      <p className="mt-1 text-sm text-text-muted">Demo-Soil-Setup ohne technische Auswahl.</p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-text-muted">Fläche</dt><dd>{zone.area_m2.toFixed(2)} m²</dd></div>
        <div><dt className="text-text-muted">Pflanzenlimit</dt><dd>{zone.maxPlants}</dd></div>
        <div><dt className="text-text-muted">Konfiguration</dt><dd>Basic Soil Pot · Pot 10 L · Single-cycle soil</dd></div>
        <div><dt className="text-text-muted">Bewässerung</dt><dd>Manual watering</dd></div>
        <div><dt className="text-text-muted">Kompatibilität</dt><dd>{compatibilityStatus === "ok" ? "Kompatibel" : "Nicht kompatibel"}</dd></div>
      </dl>
      <ul className="mt-4 space-y-2" aria-label="Notwendige Geräte">{plan.lines.map((line) => <li key={line.blueprintId} className="flex justify-between gap-4 text-sm"><span>{line.quantity} × {line.label} ({line.unitCoverage_m2.toFixed(1)} m²)</span><span>{line.totalCostCc.toFixed(2)} CC</span></li>)}</ul>
      <p className="mt-4 font-semibold">Einmalkosten: {plan.totalCostCc.toFixed(2)} CC</p>
      <p className="mt-1 text-xs text-text-muted">Die Guthabenbuchung folgt mit dem Economy-Ledger in R-501.</p>
      <div className="mt-4" aria-live="polite">
        {readiness?.status === "ready" ? <p className="font-semibold text-accent-primary">bereit</p> : null}
        {readiness?.status === "missing-prerequisites" ? <div><p className="font-semibold">Fehlende Voraussetzungen:</p><ul className="list-disc pl-5">{readiness.missingPrerequisites.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
        {!readiness ? <p className="text-sm text-text-muted">Readiness wird aus dem Read Model geladen.</p> : null}
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
      {readiness?.status !== "ready" ? <button type="button" className="mt-4 rounded-lg bg-accent-primary px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={!canSubmit || isPending} onClick={() => { void submitSetup(); }}>{isPending ? "Geräte werden installiert…" : "Zone einrichten"}</button> : null}
    </section>
  );
}
