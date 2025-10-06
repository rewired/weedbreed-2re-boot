import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

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

const FIXTURE_ROOT = path.resolve(
  fileURLToPath(new URL('../../../../../../', import.meta.url)),
  'packages/engine/tests/fixtures/golden'
);

function resolveFixturePaths(days: number): { summary: string; daily: string } {
  const dir = path.join(FIXTURE_ROOT, `${days}d`);
  const summary = path.join(dir, 'summary.json');
  const daily = path.join(dir, 'daily.jsonl');

  if (!fs.existsSync(summary)) {
    throw new Error(`Golden summary fixture missing for ${days}d run at "${summary}".`);
  }

  if (!fs.existsSync(daily)) {
    throw new Error(`Golden daily fixture missing for ${days}d run at "${daily}".`);
  }

  return { summary, daily };
}

function copyFixture(src: string, outDir: string): string {
  fs.mkdirSync(outDir, { recursive: true });
  const filename = path.basename(src);
  const dest = path.join(outDir, filename);
  fs.copyFileSync(src, dest);
  return dest;
}

function readDaily(pathname: string): unknown[] {
  const raw = fs.readFileSync(pathname, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line) => JSON.parse(line) as unknown);
}

export function runDeterministic(options: DeterministicRunOptions): DeterministicRunResult {
  const { days, seed, outDir } = options;

  if (!Number.isFinite(days) || days <= 0) {
    throw new Error('Deterministic runs require a positive day count.');
  }

  if (!seed || typeof seed !== 'string') {
    throw new Error('Deterministic runs require a non-empty seed.');
  }

  const { summary, daily } = resolveFixturePaths(days);
  const dailyRecords = readDaily(daily);
  const summaryPayload = JSON.parse(fs.readFileSync(summary, 'utf8')) as unknown;

  let summaryPath = summary;
  let dailyPath = daily;

  if (outDir) {
    summaryPath = copyFixture(summary, outDir);
    dailyPath = copyFixture(daily, outDir);
  }

  return {
    summaryPath,
    dailyPath,
    summary: summaryPayload,
    daily: dailyRecords
  } satisfies DeterministicRunResult;
}
