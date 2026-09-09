import { useEffect, useRef, useState, type ReactElement } from "react";

import { BreedingComparisonTable } from "@ui/features/breeding/BreedingComparisonTable";
import { refreshReadModels } from "@ui/state/readModels";
import type { BreedingReadModel } from "@ui/state/breedingReadModels.types";
import type { IntentClient } from "@ui/transport";

export interface BreedingLabProps {
  readonly breeding: BreedingReadModel;
  readonly intentClient: IntentClient | null;
  readonly onRefresh?: () => Promise<void>;
}

function authoritativeError(result: Awaited<ReturnType<IntentClient["submit"]>>): string | null {
  if (result.ok) return null;
  const detail = result.ack.error.message.trim();
  return detail.length > 0 ? detail : result.dictionary.description;
}

/** Runs the authoritative F1 cross and candidate-selection workflow. */
export function BreedingLab({ breeding, intentClient, onRefresh = refreshReadModels }: BreedingLabProps): ReactElement {
  const firstParentId = breeding.qualifiedParents[0]?.strainId ?? "";
  const secondParentId = breeding.qualifiedParents.find((parent) => parent.strainId !== firstParentId)?.strainId ?? "";
  const [seedParentId, setSeedParentId] = useState(firstParentId);
  const [pollenParentId, setPollenParentId] = useState(secondParentId);
  const [populationSize, setPopulationSize] = useState<3 | 4 | 5>(4);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [customName, setCustomName] = useState("");
  const [pendingAction, setPendingAction] = useState<"cross" | "select" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const crossIntentId = useRef(globalThis.crypto.randomUUID());
  const selectionIntentId = useRef(globalThis.crypto.randomUUID());
  const latestRun = breeding.runs.at(-1) ?? null;
  const openRun = latestRun?.status === "candidates-generated" ? latestRun : null;

  useEffect(() => {
    if (!breeding.qualifiedParents.some((parent) => parent.strainId === seedParentId)) {
      setSeedParentId(firstParentId);
    }
    if (!breeding.qualifiedParents.some((parent) => parent.strainId === pollenParentId) || pollenParentId === seedParentId) {
      setPollenParentId(breeding.qualifiedParents.find((parent) => parent.strainId !== seedParentId)?.strainId ?? "");
    }
  }, [breeding.qualifiedParents, firstParentId, pollenParentId, seedParentId]);

  useEffect(() => {
    if (!latestRun || latestRun.status === "selected") {
      setSelectedCandidateId(latestRun?.selectedCandidateId ?? "");
      return;
    }
    if (!latestRun.candidates.some((candidate) => candidate.candidateId === selectedCandidateId)) {
      setSelectedCandidateId("");
    }
  }, [latestRun, selectedCandidateId]);

  async function crossF1(): Promise<void> {
    if (!intentClient || !breeding.laboratory || !breeding.crossEligibility.eligible || seedParentId === pollenParentId || pendingAction) return;
    setPendingAction("cross");
    setError(null);
    try {
      const result = await intentClient.submit({
        type: "breeding.crossF1.v1",
        intentId: crossIntentId.current,
        laboratoryRoomId: breeding.laboratory.roomId,
        seedParentId,
        pollenParentId,
        populationSize
      }, { onResult() { /* The resolved acknowledgement gates the refresh. */ } });
      const message = authoritativeError(result);
      if (message) {
        setError(message);
        return;
      }
      await onRefresh();
      crossIntentId.current = globalThis.crypto.randomUUID();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Der F1-Cross konnte nicht abgeschlossen werden.");
    } finally {
      setPendingAction(null);
    }
  }

  async function selectCandidate(): Promise<void> {
    if (!intentClient || !openRun || !selectedCandidateId || customName.trim().length === 0 || pendingAction) return;
    setPendingAction("select");
    setError(null);
    try {
      const result = await intentClient.submit({
        type: "breeding.selectCandidate.v1",
        intentId: selectionIntentId.current,
        runId: openRun.runId,
        candidateId: selectedCandidateId,
        name: customName.trim()
      }, { onResult() { /* The resolved acknowledgement gates the refresh. */ } });
      const message = authoritativeError(result);
      if (message) {
        setError(message);
        return;
      }
      await onRefresh();
      selectionIntentId.current = globalThis.crypto.randomUUID();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Der Kandidat konnte nicht übernommen werden.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section aria-labelledby="breeding-lab-heading" className="space-y-6">
      <header>
        <p className="text-sm text-text-muted">{breeding.laboratory?.roomName ?? "Kein Laboratory verfügbar"}</p>
        <h1 id="breeding-lab-heading" className="text-3xl font-semibold text-text-primary">Breeding Lab</h1>
        <p className="mt-2 text-sm text-text-muted">Kreuze zwei bewährte Eltern und wähle anhand ihrer sichtbaren Traits deine erste F1.</p>
      </header>

      {!openRun ? (
        <section aria-labelledby="cross-heading" className="rounded-xl border border-border-base bg-canvas-raised p-5">
          <h2 id="cross-heading" className="text-lg font-semibold">F1-Population erzeugen</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="grid gap-1 text-sm">Samen-Elternteil
              <select aria-label="Samen-Elternteil" value={seedParentId} disabled={pendingAction !== null} onChange={(event) => setSeedParentId(event.target.value)} className="rounded border border-border-base bg-canvas-base px-3 py-2">
                {breeding.qualifiedParents.map((parent) => <option key={parent.strainId} value={parent.strainId} disabled={parent.strainId === pollenParentId}>{parent.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Pollen-Elternteil
              <select aria-label="Pollen-Elternteil" value={pollenParentId} disabled={pendingAction !== null} onChange={(event) => setPollenParentId(event.target.value)} className="rounded border border-border-base bg-canvas-base px-3 py-2">
                {breeding.qualifiedParents.map((parent) => <option key={parent.strainId} value={parent.strainId} disabled={parent.strainId === seedParentId}>{parent.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Populationsgröße
              <select aria-label="Populationsgröße" value={populationSize} disabled={pendingAction !== null} onChange={(event) => setPopulationSize(Number(event.target.value) as 3 | 4 | 5)} className="rounded border border-border-base bg-canvas-base px-3 py-2">
                {[3, 4, 5].map((size) => <option key={size} value={size}>{size} Kandidaten</option>)}
              </select>
            </label>
          </div>
          {!breeding.crossEligibility.eligible ? <p className="mt-4 text-sm text-accent-warning">Zucht noch nicht möglich: {breeding.crossEligibility.reasons.join(", ")}</p> : null}
          <button type="button" className="mt-4 rounded bg-accent-primary px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={!intentClient || !breeding.crossEligibility.eligible || !seedParentId || !pollenParentId || seedParentId === pollenParentId || pendingAction !== null} onClick={() => { void crossF1(); }}>
            {pendingAction === "cross" ? "Cross wird bestätigt…" : "F1-Cross starten"}
          </button>
        </section>
      ) : null}

      {latestRun ? (
        <section aria-labelledby="comparison-heading" className="space-y-4 rounded-xl border border-border-base bg-canvas-raised p-5">
          <div>
            <h2 id="comparison-heading" className="text-lg font-semibold">Eltern und F1-Kandidaten</h2>
            <p className="text-sm text-text-muted">Population {latestRun.populationSize} · Abweichungen stammen aus dem autoritativen Elternmittel.</p>
          </div>
          <BreedingComparisonTable run={latestRun} selectedCandidateId={selectedCandidateId} onCandidateSelect={setSelectedCandidateId} disabled={latestRun.status === "selected" || pendingAction !== null} />
          {latestRun.status === "candidates-generated" ? (
            <div className="grid gap-3 rounded-lg border border-border-base p-4 md:grid-cols-[1fr_auto] md:items-end">
              <label className="grid gap-1 text-sm">Name der eigenen Sorte
                <input aria-label="Name der eigenen Sorte" value={customName} maxLength={80} disabled={pendingAction !== null} onChange={(event) => setCustomName(event.target.value)} placeholder="Ramp One" className="rounded border border-border-base bg-canvas-base px-3 py-2" />
              </label>
              <button type="button" className="rounded bg-accent-primary px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={!intentClient || !selectedCandidateId || customName.trim().length === 0 || pendingAction !== null} onClick={() => { void selectCandidate(); }}>
                {pendingAction === "select" ? "Auswahl wird bestätigt…" : "Als Sorte übernehmen"}
              </button>
            </div>
          ) : (
            <p role="status" className="rounded-lg border border-accent-primary/50 bg-accent-primary/10 p-4 text-text-primary">
              <strong>{latestRun.customStrain?.name}</strong> wurde übernommen und ist jetzt in leeren, kompatiblen Grow-Zones anbaubar.
            </p>
          )}
        </section>
      ) : null}

      {error ? <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">{error}</p> : null}
    </section>
  );
}
