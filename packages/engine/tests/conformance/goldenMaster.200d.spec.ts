import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runDeterministic } from '@/backend/src/engine/testHarness';
import type {
  DailyRecord,
  ScenarioSummary,
} from '@/backend/src/engine/conformance/goldenScenario';

const FIXTURE_ROOT = fileURLToPath(new URL('../fixtures/golden/', import.meta.url));

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
  it('golden-200d::replays the long-run fixture without drift', () => {
    const expectedSummary = loadSummary(200);
    const expectedDaily = loadDaily(200);

    const result = runDeterministic({ days: 200, seed: 'gm-001' });

    expect(result.summary).toEqual(expectedSummary);
    expect(result.daily).toEqual(expectedDaily);
    expect(result.daily).toHaveLength(200);

    const typedSummary = result.summary as ScenarioSummary;
    const typedDaily = result.daily as DailyRecord[];

    const expectedHashes = expectedDaily.map((entry) => entry.hash);
    const actualHashes = typedDaily.map((entry) => entry.hash);
    expect(actualHashes).toEqual(expectedHashes);

    const harvestEvents = typedSummary.events.totals.harvest;
    expect(typedSummary.inventory.totalLots).toBe(harvestEvents);
    expect(typedSummary.inventory.lots).toHaveLength(harvestEvents);

    for (const lot of typedSummary.inventory.lots) {
      expect(lot.harvestDay).toBe(lot.storedAtDay);
    }

    for (const zone of typedSummary.lifecycle.zones) {
      expect(zone.harvests).toBeGreaterThan(0);
      expect(zone.replants).toBeGreaterThanOrEqual(zone.harvests);
    }

    const dailyByDay = new Map(typedDaily.map((entry) => [entry.day, entry] as const));

    for (const dayRecord of typedDaily) {
      if (dayRecord.events.harvest === 0) {
        continue;
      }

      if (dayRecord.day < typedDaily.length) {
        const nextDay = dailyByDay.get(dayRecord.day + 1);
        expect(nextDay?.events.replant ?? 0).toBeGreaterThanOrEqual(dayRecord.events.harvest);
      }
    }

    const replantDaySet = new Set(typedSummary.lifecycle.replants.map((record) => record.day));
    expect(replantDaySet.size).toBeGreaterThan(0);

    for (const record of typedSummary.lifecycle.replants) {
      const dailyEntry = dailyByDay.get(record.day);
      expect(dailyEntry?.events.replant ?? 0).toBeGreaterThan(0);
    }
  });

  it('golden-200d::writes soak artifacts to the reporting directory', () => {
    const outDir = path.resolve(process.cwd(), 'reporting', '200d');
    const result = runDeterministic({ days: 200, seed: 'gm-001', outDir });

    const summaryOnDisk = JSON.parse(
      fs.readFileSync(path.join(outDir, 'summary.json'), 'utf8')
    ) as ScenarioSummary;
    const dailyOnDisk = fs
      .readFileSync(path.join(outDir, 'daily.jsonl'), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as DailyRecord);

    expect(summaryOnDisk).toEqual(result.summary);
    expect(dailyOnDisk).toEqual(result.daily);
  });
});
