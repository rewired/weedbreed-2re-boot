import path from 'node:path';

import { fileURLToPath } from 'node:url';

import { generateGoldenScenarioRun } from './goldenScenario.ts';
import {
  assertDailyFixtureMatch,
  assertFixtureMatch,
  ensureDir,
  writeDailyFile,
  writeSummaryFile,
} from './fixtures/io.ts';

export interface DeterministicRunOptions {
  readonly days: number;
  readonly seed: string;
  readonly outDir?: string;
}

export interface DeterministicRunResult {
  readonly summaryPath: string;
  readonly dailyPath: string;
  readonly summary: unknown;
  readonly daily: readonly unknown[];
}

const FIXTURE_ROOT = fileURLToPath(
  new URL('../../../../../tests/fixtures/golden/', import.meta.url)
);

function resolveFixtureDir(days: number): string {
  return path.join(FIXTURE_ROOT, `${days}d`);
}

export function runDeterministic(options: DeterministicRunOptions): DeterministicRunResult {
  const { days, seed, outDir } = options;

  if (!Number.isFinite(days) || days <= 0) {
    throw new Error('Deterministic runs require a positive day count.');
  }

  if (!seed || typeof seed !== 'string') {
    throw new Error('Deterministic runs require a non-empty seed.');
  }

  const run = generateGoldenScenarioRun(days, seed);

  const targetDir = outDir ?? resolveFixtureDir(days);
  ensureDir(targetDir);

  const summaryPath = path.join(targetDir, 'summary.json');
  const dailyPath = path.join(targetDir, 'daily.jsonl');

  if (outDir) {
    writeSummaryFile(summaryPath, run.summary);
    writeDailyFile(dailyPath, run.daily);
  } else {
    assertFixtureMatch(summaryPath, run.summary);
    assertDailyFixtureMatch(dailyPath, run.daily);
  }

  return {
    summaryPath,
    dailyPath,
    summary: run.summary,
    daily: run.daily,
  } satisfies DeterministicRunResult;
}
