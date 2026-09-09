import { useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import type { IntentClient } from "@ui/transport";

export interface NewGameScreenProps {
  readonly intentClient: IntentClient | null;
  readonly onStarted: () => void;
  readonly secondaryActions?: ReactNode;
}

export function NewGameScreen({ intentClient, onStarted, secondaryActions }: NewGameScreenProps): ReactElement {
  const [companyName, setCompanyName] = useState("");
  const [seed, setSeed] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalizedName = companyName.trim();
    if (!normalizedName || isPending) return;
    if (!intentClient) {
      setError("Keine Verbindung zur Simulation. Bitte starte den Server und versuche es erneut.");
      return;
    }

    setIsPending(true);
    setError(null);
    try {
      const normalizedSeed = seed.trim();
      const result = await intentClient.submit(
        {
          type: "game.new.v1",
          companyName: normalizedName,
          ...(normalizedSeed ? { seed: normalizedSeed } : {})
        },
        {
          onResult() {
            // The resolved acknowledgement controls the session transition.
          }
        }
      );
      if (!result.ok) {
        setError(result.dictionary.description || "Das neue Spiel konnte nicht gestartet werden.");
        return;
      }
      if (result.ack.ok) {
        onStarted();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Das neue Spiel konnte nicht gestartet werden.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas-base px-6 text-text-primary">
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
      <section className="w-full rounded-2xl border border-border-base bg-canvas-raised p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-primary">Weed Breed</p>
        <h1 className="mt-3 text-3xl font-semibold">New Game</h1>
        <p className="mt-2 text-sm text-text-muted">
          Starte deinen reproduzierbaren Grow und erschaffe deine erste eigene Sorte.
        </p>
        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <label className="block text-sm font-medium">
            Company Name
            <input
              className="mt-2 w-full rounded-lg border border-border-base bg-canvas-base px-3 py-2"
              required
              maxLength={80}
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              disabled={isPending}
            />
          </label>
          <label className="block text-sm font-medium">
            Seed <span className="font-normal text-text-muted">(optional)</span>
            <input
              className="mt-2 w-full rounded-lg border border-border-base bg-canvas-base px-3 py-2"
              maxLength={128}
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              disabled={isPending}
            />
          </label>
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <button
            className="w-full rounded-lg bg-accent-primary px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isPending || !companyName.trim()}
          >
            {isPending ? "Spiel wird gestartet…" : "New Game"}
          </button>
        </form>
      </section>
      {secondaryActions ? <div>{secondaryActions}</div> : null}
      </div>
    </main>
  );
}
