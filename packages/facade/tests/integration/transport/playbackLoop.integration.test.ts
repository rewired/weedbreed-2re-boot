import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* eslint-disable wb-sim/no-ts-import-js-extension */

import { createDemoWorld } from '@/backend/src/engine/testHarness.ts';
import { TELEMETRY_TICK_COMPLETED_V1 } from '@/backend/src/telemetry/topics.ts';

import { createEngineCommandPipeline } from '../../../src/transport/engineCommandPipeline.js';
import { createPlaybackController } from '../../../src/transport/playbackController.js';

interface TelemetryEvent {
  readonly topic: string;
  readonly payload: Record<string, unknown>;
}

type PlaybackHarness = ReturnType<typeof createPlaybackHarness>;

function createPlaybackHarness(options?: { baseIntervalMs?: number; autoStart?: boolean }) {
  const telemetryEvents: TelemetryEvent[] = [];
  let world = createDemoWorld();

  const pipeline = createEngineCommandPipeline({
    world: {
      get: () => world,
      set(nextWorld) {
        world = nextWorld;
      },
    },
    context: {
      telemetry: {
        emit(topic: string, payload: Record<string, unknown>) {
          telemetryEvents.push({ topic, payload });
        },
      },
    },
  });

  const playback = createPlaybackController({
    pipeline,
    baseIntervalMs: options?.baseIntervalMs ?? 100,
    autoStart: options?.autoStart ?? false,
  });

  return {
    playback,
    pipeline,
    telemetryEvents,
    getWorld: () => world,
  } as const;
}

describe('transport playback loop — telemetry integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('emits tick telemetry for each scheduled advancement while playing', () => {
    const harness: PlaybackHarness = createPlaybackHarness({ baseIntervalMs: 50, autoStart: false });
    const { playback, telemetryEvents, getWorld } = harness;

    try {
      playback.play();

      expect(telemetryEvents).toHaveLength(0);

      vi.advanceTimersByTime(50);
      const firstTickEvents = telemetryEvents.filter((event) => event.topic === TELEMETRY_TICK_COMPLETED_V1);
      expect(firstTickEvents).toHaveLength(1);
      expect(firstTickEvents[0]?.topic).toBe(TELEMETRY_TICK_COMPLETED_V1);
      expect(getWorld().simTimeHours).toBe(1);

      vi.advanceTimersByTime(50);
      const secondTickEvents = telemetryEvents.filter((event) => event.topic === TELEMETRY_TICK_COMPLETED_V1);
      expect(secondTickEvents).toHaveLength(2);
      expect(secondTickEvents.at(-1)?.topic).toBe(TELEMETRY_TICK_COMPLETED_V1);
      expect(getWorld().simTimeHours).toBe(2);
    } finally {
      playback.dispose();
    }
  });

  it('respects pause controls and still emits telemetry when stepping while paused', () => {
    const harness: PlaybackHarness = createPlaybackHarness({ baseIntervalMs: 75, autoStart: false });
    const { playback, telemetryEvents, getWorld } = harness;

    try {
      playback.play();
      vi.advanceTimersByTime(75);
      expect(getWorld().simTimeHours).toBe(1);
      const initialTickEvents = telemetryEvents.filter((event) => event.topic === TELEMETRY_TICK_COMPLETED_V1);
      expect(initialTickEvents).toHaveLength(1);

      playback.pause();
      const pausedTickCount = initialTickEvents.length;

      vi.advanceTimersByTime(300);
      const afterPauseTickEvents = telemetryEvents.filter((event) => event.topic === TELEMETRY_TICK_COMPLETED_V1);
      expect(afterPauseTickEvents).toHaveLength(pausedTickCount);
      expect(getWorld().simTimeHours).toBe(1);

      playback.step();
      const afterStepTickEvents = telemetryEvents.filter((event) => event.topic === TELEMETRY_TICK_COMPLETED_V1);
      expect(afterStepTickEvents).toHaveLength(pausedTickCount + 1);
      expect(afterStepTickEvents.at(-1)?.topic).toBe(TELEMETRY_TICK_COMPLETED_V1);
      expect(getWorld().simTimeHours).toBe(2);

      playback.play();
      vi.advanceTimersByTime(75);
      const afterResumeTickEvents = telemetryEvents.filter((event) => event.topic === TELEMETRY_TICK_COMPLETED_V1);
      expect(afterResumeTickEvents).toHaveLength(pausedTickCount + 2);
      expect(getWorld().simTimeHours).toBe(3);
    } finally {
      playback.dispose();
    }
  });
});
