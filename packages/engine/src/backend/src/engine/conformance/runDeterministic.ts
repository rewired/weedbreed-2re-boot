import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
import safeStringify from 'safe-stable-stringify';

import { generateGoldenScenarioRun } from './goldenScenario.ts';

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

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeSummaryFile(filePath: string, payload: unknown): void {
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  fs.writeFileSync(filePath, json, 'utf8');
}

function writeDailyFile(filePath: string, payload: readonly unknown[]): void {
  const lines = payload.map((entry) => JSON.stringify(entry));
  const joined = `${lines.join('\n')}\n`;
  fs.writeFileSync(filePath, joined, 'utf8');
}

function readSummaryFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function readDailyFile(filePath: string): unknown[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

function assertFixtureMatch(filePath: string, payload: unknown): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected golden fixture missing at "${filePath}".`);
  }

  const recorded = readSummaryFile(filePath);

  if (safeStringify(recorded) !== safeStringify(payload)) {
    throw new Error(`Golden summary drift detected for "${filePath}".`);
  }
}

function assertDailyFixtureMatch(filePath: string, payload: readonly unknown[]): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected golden daily fixture missing at "${filePath}".`);
  }

  const recorded = readDailyFile(filePath);

  if (safeStringify(recorded) !== safeStringify(payload)) {
    throw new Error(`Golden daily drift detected for "${filePath}".`);
  }
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
