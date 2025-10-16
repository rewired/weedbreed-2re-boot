import { create } from "zustand";

/* eslint-disable-next-line @typescript-eslint/no-magic-numbers */
export const SIM_SPEED_OPTIONS = [1, 5, 10, 25, 100] as const;

export type SimulationSpeedMultiplier = (typeof SIM_SPEED_OPTIONS)[number];

interface SimulationControlState {
  readonly isPlaying: boolean;
  readonly speed: SimulationSpeedMultiplier;
  readonly requestPlay: () => Promise<void>;
  readonly requestPause: () => Promise<void>;
  readonly requestStep: () => Promise<void>;
  readonly requestSpeed: (speed: SimulationSpeedMultiplier) => Promise<void>;
}

const createResolvedPromise = () => Promise.resolve();

export const useSimulationControlsStore = create<SimulationControlState>((set) => ({
  isPlaying: true,
  speed: SIM_SPEED_OPTIONS[0],
  requestPlay: () => {
    set(() => ({ isPlaying: true }));
    return createResolvedPromise();
  },
  requestPause: () => {
    set(() => ({ isPlaying: false }));
    return createResolvedPromise();
  },
  requestStep: () => createResolvedPromise(),
  requestSpeed: (speed) => {
    set(() => ({ speed }));
    return createResolvedPromise();
  }
}));

export interface SimulationControlsSnapshot {
  readonly isPlaying: boolean;
  readonly speed: SimulationSpeedMultiplier;
  readonly requestPlay: () => Promise<void>;
  readonly requestPause: () => Promise<void>;
  readonly requestStep: () => Promise<void>;
  readonly requestSpeed: (speed: SimulationSpeedMultiplier) => Promise<void>;
}

export function useSimulationControls(): SimulationControlsSnapshot {
  return useSimulationControlsStore((state) => ({
    isPlaying: state.isPlaying,
    speed: state.speed,
    requestPlay: state.requestPlay,
    requestPause: state.requestPause,
    requestStep: state.requestStep,
    requestSpeed: state.requestSpeed
  }));
}
