/* eslint-disable wb-sim/no-ts-import-js-extension */

import { type EngineCommandPipeline } from './engineCommandPipeline.js';

const DEFAULT_BASE_INTERVAL_MS = 1000;
const DEFAULT_INITIAL_SPEED = 1;

export interface PlaybackControllerState {
  readonly isPlaying: boolean;
  readonly speedMultiplier: number;
}

export interface PlaybackControllerOptions {
  readonly pipeline: Pick<EngineCommandPipeline, 'advanceTick'>;
  readonly baseIntervalMs?: number;
  readonly initialSpeedMultiplier?: number;
  readonly autoStart?: boolean;
  readonly onTick?: () => void;
}

export interface PlaybackController {
  getState(): PlaybackControllerState;
  play(): void;
  pause(): void;
  step(): void;
  setSpeed(multiplier: number): void;
  dispose(): void;
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive, finite number.`);
  }
}

export function createPlaybackController(options: PlaybackControllerOptions): PlaybackController {
  const pipeline = options.pipeline;
  const baseIntervalMs = options.baseIntervalMs ?? DEFAULT_BASE_INTERVAL_MS;
  const autoStart = options.autoStart ?? true;
  const onTick = options.onTick;

  assertPositiveFinite(baseIntervalMs, 'baseIntervalMs');

  let speedMultiplier = options.initialSpeedMultiplier ?? DEFAULT_INITIAL_SPEED;
  assertPositiveFinite(speedMultiplier, 'initialSpeedMultiplier');

  let isPlaying = Boolean(autoStart);
  let scheduledTick: NodeJS.Timeout | null = null;

  const runTick = () => {
    pipeline.advanceTick();
    onTick?.();
  };

  const scheduleNextTick = () => {
    if (!isPlaying) {
      return;
    }

    if (scheduledTick) {
      clearTimeout(scheduledTick);
      scheduledTick = null;
    }

    const delayMs = baseIntervalMs / speedMultiplier;

    scheduledTick = setTimeout(() => {
      scheduledTick = null;
      runTick();
      scheduleNextTick();
    }, delayMs);
  };

  const clearScheduledTick = () => {
    if (!scheduledTick) {
      return;
    }

    clearTimeout(scheduledTick);
    scheduledTick = null;
  };

  if (isPlaying) {
    scheduleNextTick();
  }

  return {
    getState(): PlaybackControllerState {
      return { isPlaying, speedMultiplier } satisfies PlaybackControllerState;
    },
    play(): void {
      if (isPlaying) {
        return;
      }

      isPlaying = true;
      scheduleNextTick();
    },
    pause(): void {
      if (!isPlaying) {
        return;
      }

      isPlaying = false;
      clearScheduledTick();
    },
    step(): void {
      runTick();
    },
    setSpeed(multiplier: number): void {
      assertPositiveFinite(multiplier, 'speedMultiplier');
      speedMultiplier = multiplier;

      if (isPlaying) {
        scheduleNextTick();
      }
    },
    dispose(): void {
      isPlaying = false;
      clearScheduledTick();
    },
  } satisfies PlaybackController;
}

