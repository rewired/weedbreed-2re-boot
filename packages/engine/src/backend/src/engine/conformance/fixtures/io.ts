import fs from 'node:fs';

import safeStringify from 'safe-stable-stringify';

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeSummaryFile(filePath: string, payload: unknown): void {
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  fs.writeFileSync(filePath, json, 'utf8');
}

export function writeDailyFile(filePath: string, payload: readonly unknown[]): void {
  const lines = payload.map((entry) => JSON.stringify(entry));
  const joined = `${lines.join('\n')}\n`;
  fs.writeFileSync(filePath, joined, 'utf8');
}

export function readSummaryFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

export function readDailyFile(filePath: string): unknown[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

export function assertFixtureMatch(filePath: string, payload: unknown): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected golden fixture missing at "${filePath}".`);
  }

  const recorded = readSummaryFile(filePath);

  if (safeStringify(recorded) !== safeStringify(payload)) {
    throw new Error(`Golden summary drift detected for "${filePath}".`);
  }
}

export function assertDailyFixtureMatch(filePath: string, payload: readonly unknown[]): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected golden daily fixture missing at "${filePath}".`);
  }

  const recorded = readDailyFile(filePath);

  if (safeStringify(recorded) !== safeStringify(payload)) {
    throw new Error(`Golden daily drift detected for "${filePath}".`);
  }
}
