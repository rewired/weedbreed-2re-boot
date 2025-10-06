import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runDeterministic } from '@/backend/src/engine/testHarness.js';

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

describe('golden master 200-day soak', () => {
  it('replays the long-run fixture without drift', () => {
    const expectedSummary = loadSummary(200);
    const expectedDaily = loadDaily(200);

    const result = runDeterministic({ days: 200, seed: 'gm-001' });

    expect(result.summary).toEqual(expectedSummary);
    expect(result.daily).toEqual(expectedDaily);
    expect(result.daily).toHaveLength(200);

    const expectedHashes = expectedDaily.map((entry) => entry.hash);
    const actualHashes = result.daily.map((entry) => entry.hash);
    expect(actualHashes).toEqual(expectedHashes);
  });
});
