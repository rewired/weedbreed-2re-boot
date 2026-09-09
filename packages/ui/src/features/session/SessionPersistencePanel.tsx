import { useState, type ReactElement } from "react";
import type { IntentClient, SuccessfulIntentAck } from "@ui/transport";
import { refreshReadModels } from "@ui/state/readModels";
import { isSessionEnvelope, type SessionEnvelope, type SessionSlot } from "./sessionEnvelope.types";
import { readSessionSlots, writeSessionSlot, type SessionSlotStorage } from "./sessionSlots";

interface SessionSaveAck extends SuccessfulIntentAck {
  readonly result: { readonly command: "session.save"; readonly session: SessionEnvelope };
}

interface SessionLoadAck extends SuccessfulIntentAck {
  readonly stateAfter: { readonly journeyMilestoneCount: number };
}

export interface SessionPersistencePanelProps {
  readonly intentClient: IntentClient | null;
  readonly sessionActive: boolean;
  readonly onLoaded: () => void;
  readonly onJourneyProgress?: (count: number) => void;
  readonly onRefresh?: () => Promise<void>;
  readonly storage?: SessionSlotStorage | null;
}

function browserStorage(): SessionSlotStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function savedSession(ack: SuccessfulIntentAck): SessionEnvelope | null {
  const result = (ack as Partial<SessionSaveAck>).result;
  return result?.command === "session.save" && isSessionEnvelope(result.session) ? result.session : null;
}

function loadedMilestoneCount(ack: SuccessfulIntentAck): number | null {
  const count = (ack as Partial<SessionLoadAck>).stateAfter?.journeyMilestoneCount;
  return typeof count === "number" && Number.isInteger(count) && count >= 0 ? count : null;
}

export function SessionPersistencePanel({
  intentClient,
  sessionActive,
  onLoaded,
  onJourneyProgress,
  onRefresh = refreshReadModels,
  storage = browserStorage()
}: SessionPersistencePanelProps): ReactElement {
  const [slotName, setSlotName] = useState("First F1");
  const [slots, setSlots] = useState<readonly SessionSlot[]>(() => storage ? readSessionSlots(storage) : []);
  const [exportJson, setExportJson] = useState("");
  const [importJson, setImportJson] = useState("");
  const [pending, setPending] = useState<"save" | "load" | "import" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(session: SessionEnvelope, source: "load" | "import"): Promise<void> {
    if (!intentClient || pending) return;
    setPending(source);
    setError(null);
    setNotice(null);
    try {
      const result = await intentClient.submit(
        { type: "session.load.v1", session },
        { onResult() { /* The awaited result below gates every local side effect. */ } }
      );
      if (!result.ok) {
        setError(result.dictionary.description || "Der Speicherstand konnte nicht geladen werden.");
        return;
      }
      const milestoneCount = loadedMilestoneCount(result.ack);
      if (milestoneCount === null) {
        setError("Die Ladebestätigung war unvollständig.");
        return;
      }
      if (source === "import") {
        if (!storage) throw new Error("Lokaler Speicher ist nicht verfügbar.");
        setSlots(writeSessionSlot(storage, slotName || "Importiert", session));
      }
      await onRefresh();
      onJourneyProgress?.(milestoneCount);
      onLoaded();
      setNotice(source === "import" ? "Importiert und geladen." : "Speicherstand geladen.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Der Speicherstand konnte nicht geladen werden.");
    } finally {
      setPending(null);
    }
  }

  async function save(): Promise<void> {
    if (!intentClient || pending || !sessionActive) return;
    setPending("save");
    setError(null);
    setNotice(null);
    try {
      const result = await intentClient.submit(
        { type: "session.save.v1" },
        { onResult() { /* The awaited result below gates persistence. */ } }
      );
      if (!result.ok) {
        setError(result.dictionary.description || "Der Speicherstand konnte nicht erstellt werden.");
        return;
      }
      const session = savedSession(result.ack);
      if (!session) {
        setError("Die Speicherbestätigung war unvollständig.");
        return;
      }
      if (!storage) throw new Error("Lokaler Speicher ist nicht verfügbar.");
      setSlots(writeSessionSlot(storage, slotName, session));
      setExportJson(JSON.stringify(session));
      onJourneyProgress?.(session.journeyProgress.milestones.length);
      setNotice(`„${slotName.trim()}“ wurde gespeichert.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Der Speicherstand konnte nicht gespeichert werden.");
    } finally {
      setPending(null);
    }
  }

  function parseAndLoadImport(): void {
    if (pending) return;
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importJson);
    } catch {
      setError("Der JSON-Import ist nicht lesbar.");
      return;
    }
    if (!isSessionEnvelope(parsed)) {
      setError("Der JSON-Import ist kein unterstützter Weed-Breed-Speicherstand.");
      return;
    }
    void load(parsed, "import");
  }

  return (
    <section aria-label="Speicherstände" className="rounded-xl border border-border-base bg-canvas-raised p-4 text-text-primary">
      <h2 className="font-semibold">Speicherstände</h2>
      <label className="mt-3 block text-sm">
        Name
        <input aria-label="Name des Speicherstands" className="mt-1 w-full rounded-lg border border-border-base bg-canvas-base px-3 py-2" value={slotName} onChange={(event) => setSlotName(event.target.value)} disabled={pending !== null} />
      </label>
      {sessionActive ? (
        <button className="mt-3 rounded-lg bg-accent-primary px-4 py-2 font-semibold text-white disabled:opacity-60" type="button" disabled={pending !== null || !slotName.trim()} onClick={() => void save()}>
          {pending === "save" ? "Speichert…" : "Spiel speichern"}
        </button>
      ) : null}
      <ul className="mt-4 space-y-2">
        {slots.map((slot) => (
          <li key={slot.name} className="flex items-center justify-between gap-3 rounded-lg border border-border-base p-3">
            <span>{slot.name}</span>
            <span className="flex gap-2">
              <button type="button" disabled={pending !== null} onClick={() => void load(slot.session, "load")}>Laden</button>
              <button type="button" disabled={pending !== null} onClick={() => setExportJson(JSON.stringify(slot.session))}>JSON exportieren</button>
            </span>
          </li>
        ))}
      </ul>
      {exportJson ? <textarea aria-label="JSON Export" className="mt-3 h-28 w-full rounded-lg border border-border-base bg-canvas-base p-2 text-xs" readOnly value={exportJson} /> : null}
      <label className="mt-4 block text-sm">
        JSON Import
        <textarea aria-label="JSON Import" className="mt-1 h-28 w-full rounded-lg border border-border-base bg-canvas-base p-2 text-xs" value={importJson} onChange={(event) => setImportJson(event.target.value)} disabled={pending !== null} />
      </label>
      <button className="mt-2 rounded-lg border border-accent-primary px-4 py-2 disabled:opacity-60" type="button" disabled={pending !== null || !importJson.trim()} onClick={parseAndLoadImport}>
        {pending === "import" ? "Importiert…" : "JSON importieren und laden"}
      </button>
      {notice ? <p role="status" className="mt-3 text-sm text-success">{notice}</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
