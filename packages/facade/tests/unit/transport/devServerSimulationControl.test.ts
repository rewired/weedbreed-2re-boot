/* eslint-disable wb-sim/no-ts-import-js-extension */

import { describe, expect, it } from 'vitest';

import type { PlaybackController } from '../../../src/transport/playbackController.js';
import { createSimulationControlIntentHandler } from '../../../src/transport/devServer.js';

interface StubPlaybackOptions {
  readonly isPlaying?: boolean;
  readonly speedMultiplier?: number;
}

function createPlaybackStub(options: StubPlaybackOptions = {}): PlaybackController {
  let isPlaying = options.isPlaying ?? false;
  let speedMultiplier = options.speedMultiplier ?? 1;

  return {
    getState() {
      return { isPlaying, speedMultiplier };
    },
    play() {
      isPlaying = true;
    },
    pause() {
      isPlaying = false;
    },
    step() {
      // Intentionally no-op; step should not mutate play state.
    },
    setSpeed(nextMultiplier: number) {
      speedMultiplier = nextMultiplier;
    },
    dispose() {
      // no-op for stub
    },
  } satisfies PlaybackController;
}

const parseSpeedMultiplier = (intent: Record<string, unknown>): number => {
  const raw = intent.multiplier;

  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    throw new Error('Speed multiplier must be a positive finite number.');
  }

  return raw;
};

describe('createSimulationControlIntentHandler', () => {
  it('acknowledges play then pause with updated playback state snapshots', () => {
    const playback = createPlaybackStub({ isPlaying: false, speedMultiplier: 5 });
    const handleIntent = createSimulationControlIntentHandler({
      playback,
      parseSpeedMultiplier,
    });

    const playAck = handleIntent({ type: 'simulation.control.play' });
    expect(playAck).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'applied',
        stateAfter: {
          running: true,
          paused: false,
          speedMultiplier: 5,
        },
      }),
    );

    const pauseAck = handleIntent({ type: 'simulation.control.pause' });
    expect(pauseAck).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'applied',
        stateAfter: {
          running: false,
          paused: true,
          speedMultiplier: 5,
        },
      }),
    );
  });

  it('acknowledges single step without toggling the paused state', () => {
    const playback = createPlaybackStub({ isPlaying: false, speedMultiplier: 2 });
    const handleIntent = createSimulationControlIntentHandler({
      playback,
      parseSpeedMultiplier,
    });

    const stepAck = handleIntent({ type: 'simulation.control.step' });
    expect(stepAck).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'applied',
        stateAfter: {
          running: false,
          paused: true,
          speedMultiplier: 2,
        },
      }),
    );
  });

  it('validates speed adjustments and surfaces the new multiplier in acknowledgements', () => {
    const playback = createPlaybackStub({ isPlaying: true, speedMultiplier: 1 });
    const handleIntent = createSimulationControlIntentHandler({
      playback,
      parseSpeedMultiplier,
    });

    const speedAck = handleIntent({ type: 'simulation.control.speed', multiplier: 10 });
    expect(speedAck).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'applied',
        stateAfter: {
          running: true,
          paused: false,
          speedMultiplier: 10,
        },
      }),
    );

    expect(() => handleIntent({ type: 'simulation.control.speed', multiplier: 0 })).toThrow(
      'Speed multiplier must be a positive finite number.',
    );
  });
});
