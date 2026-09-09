/* eslint-disable wb-sim/no-ts-import-js-extension */

import { describe, expect, it } from 'vitest';
import { runDeterministicJourneyReplay } from './journeyReplayHarness.js';

describe('R-900 deterministic full-journey replay', () => {
  it('produces identical daily hashes, final state, events, and milestone completion twice', async () => {
    const first = await runDeterministicJourneyReplay();
    const second = await runDeterministicJourneyReplay();

    expect(first.dailyWorldHashes.length).toBeGreaterThan(100);
    expect(second.dailyWorldHashes).toEqual(first.dailyWorldHashes);
    expect(second.finalWorldHash).toBe(first.finalWorldHash);
    expect(second.eventCount).toBe(first.eventCount);
    expect(second.milestoneCount).toBe(first.milestoneCount);
    expect(second.trace).toEqual(first.trace);
    expect(first.milestoneCount).toBe(9);
  }, 180_000);
});
