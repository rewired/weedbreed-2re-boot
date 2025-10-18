import { useCallback } from "react";
import { create } from "zustand";

import type { TransportIntentEnvelope } from "@wb/transport-sio";

import type { IntentClient, SuccessfulIntentAck } from "@ui/transport/intentClient";
import { useIntentClient } from "@ui/transport";

/* eslint-disable-next-line @typescript-eslint/no-magic-numbers */
export const SIM_SPEED_OPTIONS = [1, 5, 10, 25, 100] as const;

export type SimulationSpeedMultiplier = (typeof SIM_SPEED_OPTIONS)[number];

interface SimulationControlState {
  readonly isPlaying: boolean;
  readonly speed: SimulationSpeedMultiplier;
  readonly setPlaying: (isPlaying: boolean) => void;
  readonly setSpeed: (speed: SimulationSpeedMultiplier) => void;
}

export const useSimulationControlsStore = create<SimulationControlState>((set) => ({
  isPlaying: true,
  speed: SIM_SPEED_OPTIONS[0],
  setPlaying: (isPlaying) => {
    set(() => ({ isPlaying }));
  },
  setSpeed: (speed) => {
    set(() => ({ speed }));
  }
}));

function createControlIntent(type: string, extras: Record<string, unknown> = {}): TransportIntentEnvelope {
  return { type, ...extras } satisfies TransportIntentEnvelope;
}

interface SimulationControlAckOverlay {
  readonly stateAfter?: {
    readonly isPaused?: unknown;
    readonly speedMultiplier?: unknown;
  };
}

type SimulationControlAck = SuccessfulIntentAck & SimulationControlAckOverlay;

interface SimulationControlAckState {
  readonly isPaused?: boolean;
  readonly speedMultiplier?: SimulationSpeedMultiplier;
}

function isSimulationSpeedMultiplier(value: unknown): value is SimulationSpeedMultiplier {
  return typeof value === "number" && SIM_SPEED_OPTIONS.includes(value as SimulationSpeedMultiplier);
}

function createLocalAck(state: SimulationControlAckState | undefined): SimulationControlAck {
  const ack: SimulationControlAck = {
    ok: true,
    status: "applied",
    intentId: null,
    correlationId: null
  } as SimulationControlAck;

  if (!state) {
    return ack;
  }

  const overlay: { isPaused?: boolean; speedMultiplier?: SimulationSpeedMultiplier } = {};

  if (typeof state.isPaused === "boolean") {
    overlay.isPaused = state.isPaused;
  }

  if (state.speedMultiplier !== undefined && isSimulationSpeedMultiplier(state.speedMultiplier)) {
    overlay.speedMultiplier = state.speedMultiplier;
  }

  if (overlay.isPaused !== undefined || overlay.speedMultiplier !== undefined) {
    ack.stateAfter = overlay;
  }

  return ack;
}

function resolveAckState(
  ack: SimulationControlAck,
  fallback: SimulationControlAckState | undefined
): SimulationControlAckState {
  const overlayCandidate = ack.stateAfter;
  let resolvedIsPaused: boolean | undefined;
  let resolvedSpeed: SimulationSpeedMultiplier | undefined;

  if (overlayCandidate && typeof overlayCandidate === "object") {
    const overlayRecord = overlayCandidate as Record<string, unknown>;
    const pausedCandidate = overlayRecord.isPaused;
    const speedCandidate = overlayRecord.speedMultiplier;

    if (typeof pausedCandidate === "boolean") {
      resolvedIsPaused = pausedCandidate;
    }

    if (isSimulationSpeedMultiplier(speedCandidate)) {
      resolvedSpeed = speedCandidate;
    }
  }

  if (resolvedIsPaused === undefined && typeof fallback?.isPaused === "boolean") {
    resolvedIsPaused = fallback.isPaused;
  }

  if (resolvedSpeed === undefined && fallback?.speedMultiplier !== undefined) {
    if (isSimulationSpeedMultiplier(fallback.speedMultiplier)) {
      resolvedSpeed = fallback.speedMultiplier;
    }
  }

  return { isPaused: resolvedIsPaused, speedMultiplier: resolvedSpeed } satisfies SimulationControlAckState;
}

async function submitControlIntent(
  client: IntentClient | null,
  intent: TransportIntentEnvelope,
  fallbackState: SimulationControlAckState | undefined,
  onSuccess: (ackState: SimulationControlAckState) => void
): Promise<void> {
  const fallbackAck = createLocalAck(fallbackState);

  if (!client) {
    onSuccess(resolveAckState(fallbackAck, fallbackState));
    return;
  }

  try {
    const result = await client.submit(intent, {
      onResult(submissionResult) {
        if (submissionResult.ok) {
          onSuccess(resolveAckState(submissionResult.ack as SimulationControlAck, fallbackState));
        }
      }
    });

    if (!result.ok) {
      console.error("Simulation control intent rejected:", result.dictionary.title);
    }
  } catch (error) {
    console.error("Failed to submit simulation control intent:", error);
  }
}

export interface SimulationControlsSnapshot {
  readonly isPlaying: boolean;
  readonly speed: SimulationSpeedMultiplier;
  readonly requestPlay: () => Promise<void>;
  readonly requestPause: () => Promise<void>;
  readonly requestStep: () => Promise<void>;
  readonly requestSpeed: (speed: SimulationSpeedMultiplier) => Promise<void>;
}

export function useSimulationControls(): SimulationControlsSnapshot {
  const intentClient = useIntentClient();
  const isPlaying = useSimulationControlsStore((state) => state.isPlaying);
  const speed = useSimulationControlsStore((state) => state.speed);
  const setPlaying = useSimulationControlsStore((state) => state.setPlaying);
  const setSpeed = useSimulationControlsStore((state) => state.setSpeed);

  const requestPlay = useCallback(async () => {
    const fallback: SimulationControlAckState = { isPaused: false };

    await submitControlIntent(intentClient, createControlIntent("simulation.control.play"), fallback, (ackState) => {
      if (ackState.speedMultiplier !== undefined) {
        setSpeed(ackState.speedMultiplier);
      }

      if (ackState.isPaused !== undefined) {
        setPlaying(!ackState.isPaused);
      }
    });
  }, [intentClient, setPlaying, setSpeed]);

  const requestPause = useCallback(async () => {
    const fallback: SimulationControlAckState = { isPaused: true };

    await submitControlIntent(intentClient, createControlIntent("simulation.control.pause"), fallback, (ackState) => {
      if (ackState.speedMultiplier !== undefined) {
        setSpeed(ackState.speedMultiplier);
      }

      if (ackState.isPaused !== undefined) {
        setPlaying(!ackState.isPaused);
      }
    });
  }, [intentClient, setPlaying, setSpeed]);

  const requestStep = useCallback(async () => {
    const fallback: SimulationControlAckState = { isPaused: true };

    await submitControlIntent(intentClient, createControlIntent("simulation.control.step"), fallback, (ackState) => {
      if (ackState.speedMultiplier !== undefined) {
        setSpeed(ackState.speedMultiplier);
      }

      if (ackState.isPaused !== undefined) {
        setPlaying(!ackState.isPaused);
      }
    });
  }, [intentClient, setPlaying, setSpeed]);

  const requestSpeed = useCallback(async (nextSpeed: SimulationSpeedMultiplier) => {
    const fallback: SimulationControlAckState = { speedMultiplier: nextSpeed };

    await submitControlIntent(
      intentClient,
      createControlIntent("simulation.control.speed", { multiplier: nextSpeed }),
      fallback,
      (ackState) => {
        if (ackState.speedMultiplier !== undefined) {
          setSpeed(ackState.speedMultiplier);
        }

        if (ackState.isPaused !== undefined) {
          setPlaying(!ackState.isPaused);
        }
      }
    );
  }, [intentClient, setPlaying, setSpeed]);

  return {
    isPlaying,
    speed,
    requestPlay,
    requestPause,
    requestStep,
    requestSpeed
  } satisfies SimulationControlsSnapshot;
}
