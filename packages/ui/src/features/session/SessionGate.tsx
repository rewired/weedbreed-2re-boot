import { useState, type ReactElement, type ReactNode } from "react";
import { useIntentClient } from "@ui/transport";
import { useReadModelStore } from "@ui/state/readModels";
import { NewGameScreen } from "./NewGameScreen";
import { SessionPersistencePanel } from "./SessionPersistencePanel";

export interface SessionGateProps {
  readonly children: ReactNode;
}

export function SessionGate({ children }: SessionGateProps): ReactElement {
  const intentClient = useIntentClient();
  const [hasStarted, setHasStarted] = useState(false);
  const [journeyProgress, setJourneyProgress] = useState(0);
  const runCompleted = useReadModelStore((state) => state.snapshot?.runSummary?.completed ?? false);
  const visibleProgress = runCompleted ? 9 : journeyProgress;

  if (!hasStarted) {
    return (
      <NewGameScreen
        intentClient={intentClient}
        onStarted={() => {
          setJourneyProgress(0);
          setHasStarted(true);
        }}
        secondaryActions={
          <SessionPersistencePanel
            intentClient={intentClient}
            sessionActive={false}
            onLoaded={() => setHasStarted(true)}
            onJourneyProgress={setJourneyProgress}
          />
        }
      />
    );
  }

  return (
    <>
      <aside
        aria-label="Journey progress"
        className="border-b border-border-base bg-canvas-raised px-6 py-3 text-text-primary"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <strong>Erzeuge und teste deine erste F1</strong>
          <span className="rounded-full border border-accent-primary px-3 py-1 text-sm font-semibold">{visibleProgress}/9</span>
        </div>
      </aside>
      <aside className="mx-auto w-full max-w-7xl px-6 py-3">
        <SessionPersistencePanel
          intentClient={intentClient}
          sessionActive
          onLoaded={() => setHasStarted(true)}
          onJourneyProgress={setJourneyProgress}
        />
      </aside>
      {children}
    </>
  );
}
