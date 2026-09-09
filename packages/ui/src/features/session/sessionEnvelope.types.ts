/** Opaque engine save returned and validated by the facade. */
export interface SessionEngineSave {
  readonly schemaVersion: 2;
  readonly seed: string;
  readonly simTime: {
    readonly tick: number;
    readonly hoursElapsed: number;
  };
  readonly world: unknown;
}

export interface SessionJourneyMilestone {
  readonly code: string;
  readonly achievedAtSimTimeHours: number;
  readonly evidenceId: string;
}

/** Exact persistence envelope owned by the facade; the UI never derives domain state. */
export interface SessionEnvelope {
  readonly sessionSchemaVersion: 1;
  readonly engineSave: SessionEngineSave;
  readonly worldHash: string;
  readonly playback: {
    readonly status: "paused" | "running";
    readonly speedMultiplier: number;
  };
  readonly journeyProgress: {
    readonly milestones: readonly SessionJourneyMilestone[];
  };
}

export interface SessionSlot {
  readonly name: string;
  readonly session: SessionEnvelope;
}

export function isSessionEnvelope(value: unknown): value is SessionEnvelope {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SessionEnvelope>;
  return candidate.sessionSchemaVersion === 1
    && candidate.engineSave?.schemaVersion === 2
    && typeof candidate.engineSave.seed === "string"
    && typeof candidate.engineSave.simTime?.tick === "number"
    && typeof candidate.engineSave.simTime.hoursElapsed === "number"
    && typeof candidate.worldHash === "string"
    && /^[a-f0-9]{64}$/i.test(candidate.worldHash)
    && (candidate.playback?.status === "paused" || candidate.playback?.status === "running")
    && typeof candidate.playback.speedMultiplier === "number"
    && Array.isArray(candidate.journeyProgress?.milestones);
}
