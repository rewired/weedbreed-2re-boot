import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runDeterministic } from '@/backend/src/engine/testHarness.js';

const EPS_ABS = 1e-9;
const EPS_REL = 1e-6;

const FIXTURE_ROOT = path.resolve(
  path.dirname(fileURLToPath(new URL('.', import.meta.url))),
  '../fixtures/golden'
);

function loadSummary(days: number) {
  const fixturePath = path.join(FIXTURE_ROOT, `${days}d/summary.json`);
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
}

function loadDaily(days: number) {
  const fixturePath = path.join(FIXTURE_ROOT, `${days}d/daily.jsonl`);
  return fs
    .readFileSync(fixturePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function approximatelyEqual(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  if (diff <= EPS_ABS) {
    return true;
  }
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return diff <= EPS_REL * scale;
}

describe('golden master 30-day conformance', () => {
  it('replays the recorded fixture with deterministic hashes and metrics', () => {
    const expectedSummary = loadSummary(30);
    const expectedDaily = loadDaily(30);

    const result = runDeterministic({ days: 30, seed: 'gm-001' });

    expect(result.summary).toEqual(expectedSummary);
    expect(result.daily).toEqual(expectedDaily);
    expect(result.daily).toHaveLength(30);
    expect(result.dailyPath).toMatch(/daily.jsonl$/);
    expect(result.summaryPath).toMatch(/summary.json$/);

    const recordedTicks = (result.summary as { run?: { ticks?: number } }).run?.ticks;
    if (typeof recordedTicks === 'number') {
      expect(approximatelyEqual(recordedTicks, 720)).toBe(true);
    }
  });
});
