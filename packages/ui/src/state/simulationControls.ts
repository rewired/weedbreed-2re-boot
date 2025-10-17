import { useCallback } from "react";
import { create } from "zustand";

import type { TransportIntentEnvelope } from "@wb/transport-sio";

import type { IntentClient } from "@ui/transport/intentClient";
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

async function submitControlIntent(
  client: IntentClient | null,
  intent: TransportIntentEnvelope,
  onSuccess: () => void
): Promise<void> {
  if (!client) {
    onSuccess();
    return;
  }

  try {
    const result = await client.submit(intent, {
      onResult(submissionResult) {
        if (submissionResult.ok) {
          onSuccess();
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
    await submitControlIntent(intentClient, createControlIntent("simulation.control.play"), () => {
      setPlaying(true);
    });
  }, [intentClient, setPlaying]);

  const requestPause = useCallback(async () => {
    await submitControlIntent(intentClient, createControlIntent("simulation.control.pause"), () => {
      setPlaying(false);
    });
  }, [intentClient, setPlaying]);

  const requestStep = useCallback(async () => {
    await submitControlIntent(intentClient, createControlIntent("simulation.control.step"), () => {
      // Intentionally no local state change; step preserves the play/pause flag.
    });
  }, [intentClient]);

  const requestSpeed = useCallback(async (nextSpeed: SimulationSpeedMultiplier) => {
    await submitControlIntent(
      intentClient,
      createControlIntent("simulation.control.speed", { multiplier: nextSpeed }),
      () => {
        setSpeed(nextSpeed);
      }
    );
  }, [intentClient, setSpeed]);

  return {
    isPlaying,
    speed,
    requestPlay,
    requestPause,
    requestStep,
    requestSpeed
  } satisfies SimulationControlsSnapshot;
}
