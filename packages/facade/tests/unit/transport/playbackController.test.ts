/* eslint-disable wb-sim/no-ts-import-js-extension */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { createDemoWorld } from '@/backend/src/engine/testHarness.ts';

import { createEngineCommandPipeline } from '../../../src/transport/engineCommandPipeline.js';
import { createPlaybackController } from '../../../src/transport/playbackController.js';

function createPipelineHarness() {
  let world = createDemoWorld();
  const pipeline = createEngineCommandPipeline({
    world: {
      get: () => world,
      set(nextWorld) {
        world = nextWorld;
      },
    },
    context: {},
  });

  return {
    pipeline,
    getWorld: () => world,
  } as const;
}

describe('createPlaybackController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('advances ticks while playing and halts when paused', () => {
    const { pipeline, getWorld } = createPipelineHarness();
    const controller = createPlaybackController({
      pipeline,
      baseIntervalMs: 100,
      autoStart: false,
    });

    expect(getWorld().simTimeHours).toBe(0);

    controller.play();
    vi.advanceTimersByTime(100);
    expect(getWorld().simTimeHours).toBe(1);

    vi.advanceTimersByTime(100);
    expect(getWorld().simTimeHours).toBe(2);

    controller.pause();
    vi.advanceTimersByTime(400);
    expect(getWorld().simTimeHours).toBe(2);

    controller.dispose();
  });

  it('steps exactly once when requested while paused', () => {
    const { pipeline, getWorld } = createPipelineHarness();
    const controller = createPlaybackController({
      pipeline,
      baseIntervalMs: 100,
      autoStart: false,
    });

    controller.pause();
    controller.step();
    expect(getWorld().simTimeHours).toBe(1);

    controller.step();
    expect(getWorld().simTimeHours).toBe(2);

    controller.dispose();
  });

  it('re-schedules ticks according to the active speed multiplier', () => {
    const { pipeline, getWorld } = createPipelineHarness();
    const controller = createPlaybackController({
      pipeline,
      baseIntervalMs: 100,
      autoStart: false,
    });

    controller.play();
    vi.advanceTimersByTime(100);
    expect(getWorld().simTimeHours).toBe(1);

    controller.setSpeed(5);
    vi.advanceTimersByTime(20);
    expect(getWorld().simTimeHours).toBe(2);

    controller.setSpeed(10);
    vi.advanceTimersByTime(10);
    expect(getWorld().simTimeHours).toBe(3);

    controller.dispose();
  });
});

