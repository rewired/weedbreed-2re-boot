import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GM_DAYS_SHORT } from '@/backend/src/constants/goldenMaster';
import { EPS_ABS, EPS_REL, HOURS_PER_DAY } from '@/backend/src/constants/simConstants';
import { fmtNum } from '@/backend/src/util/format';
import { runDeterministic } from '@/backend/src/engine/testHarness';
import type {
  DailyRecord,
  ScenarioSummary,
} from '@/backend/src/engine/conformance/goldenScenario';

const FIXTURE_ROOT = fileURLToPath(new URL('../fixtures/golden/', import.meta.url));

function loadSummary(days: number) {
  const fixturePath = path.join(FIXTURE_ROOT, `${fmtNum(days)}d/summary.json`);
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
}

function loadDaily(days: number) {
  const fixturePath = path.join(FIXTURE_ROOT, `${fmtNum(days)}d/daily.jsonl`);
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
  it('golden-30d::replays the recorded fixture with deterministic hashes and metrics', () => {
    const expectedSummary = loadSummary(GM_DAYS_SHORT);
    const expectedDaily = loadDaily(GM_DAYS_SHORT);

    const result = runDeterministic({ days: GM_DAYS_SHORT, seed: 'gm-001' });

    expect(result.summary).toEqual(expectedSummary);
    expect(result.daily).toEqual(expectedDaily);
    expect(result.daily).toHaveLength(GM_DAYS_SHORT);
    expect(result.dailyPath).toMatch(/daily.jsonl$/);
    expect(result.summaryPath).toMatch(/summary.json$/);

    const typedSummary = result.summary as ScenarioSummary;
    const typedDaily = result.daily as DailyRecord[];

    const recordedTicks = typedSummary.run.ticks;
    if (typeof recordedTicks === 'number') {
      expect(approximatelyEqual(recordedTicks, HOURS_PER_DAY * GM_DAYS_SHORT)).toBe(true);
    }

    const structure = typedSummary.topology.structure;
    expect(structure.rooms).toHaveLength(3);

    const growroom = structure.rooms.find((room) => room.purpose === 'growroom');
    expect(growroom?.zones).toHaveLength(5);

    for (const zone of growroom?.zones ?? []) {
      expect(zone.lighting.coverageRatio).toBeGreaterThanOrEqual(1);
      expect(zone.climate.airChangesPerHour).toBeGreaterThanOrEqual(1);
    }

    const storageRoom = structure.rooms.find((room) => room.purpose === 'storageroom');
    const breakroom = structure.rooms.find((room) => room.purpose === 'breakroom');
    expect(storageRoom?.zones).toEqual([]);
    expect(breakroom?.zones).toEqual([]);

    expect(typedSummary.inventory.totalLots).toBeGreaterThan(0);
    for (const lot of typedSummary.inventory.lots) {
      expect(lot.harvestDay).toBe(lot.storedAtDay);
    }

    const breakCompliance = typedSummary.workforce.breakCompliance;
    expect(breakCompliance).toHaveLength(3);
    for (const entry of breakCompliance) {
      expect(entry.breaksTaken).toBeGreaterThanOrEqual(entry.required);
      expect(entry.rooms).toEqual([breakroom?.id]);
    }

    expect(typedSummary.workforce.janitorialCoverage.storageRoomDays.length).toBeGreaterThan(0);
    expect(typedSummary.workforce.janitorialCoverage.breakroomDays.length).toBeGreaterThan(0);

    for (const day of typedDaily) {
      for (const workforceBreak of day.workforce.breaks) {
        expect(workforceBreak.roomId).toBe(breakroom?.id);
      }
      for (const janitorial of day.workforce.janitorial) {
        expect([storageRoom?.id, breakroom?.id]).toContain(janitorial.roomId);
      }
      expect(day.inventory.movedToStorage).toEqual(day.inventory.createdLots);
      expect(day.inventory.storageLotIds).toEqual([...day.inventory.storageLotIds].sort());
    }
  });

  it('golden-30d::emits artifacts when an output directory is provided', () => {
    const outDir = path.resolve(process.cwd(), 'reporting', `${fmtNum(GM_DAYS_SHORT)}d`);
    const result = runDeterministic({ days: GM_DAYS_SHORT, seed: 'gm-001', outDir });

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
