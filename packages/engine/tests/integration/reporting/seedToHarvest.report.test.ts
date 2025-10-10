import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { generateSeedToHarvestReport } from '@/backend/src/engine/reporting/generateSeedToHarvestReport';

describe('Seed-to-harvest reporting generator', () => {
  it('produces a persisted report with consistent summaries', async () => {
    const scenario = 'integration-test';
    const tickCount = 5;
    const report = generateSeedToHarvestReport({ ticks: tickCount, scenario });

    expect(report.summary.ticksElapsed).toBeGreaterThan(0);
    expect(report.performance.tickCount).toBe(tickCount);
    expect(report.performance.traces).toHaveLength(tickCount);
    expect(report.stages.summary.totalTransitions).toBe(report.stages.transitions.length);
    expect(report.stages.summary.photoperiodTransitionCount).toBe(
      report.stages.photoperiodTransitions.length
    );
    expect(report.telemetry.summary.totalEvents).toBe(report.telemetry.harvestEvents.length);

    const tempDir = await mkdtemp(path.join(tmpdir(), 'wb-report-'));
    const artifactPath = path.join(tempDir, 'seed-to-harvest.json');

    await writeFile(artifactPath, JSON.stringify(report, null, 2), 'utf-8');

    const persisted = JSON.parse(await readFile(artifactPath, 'utf-8')) as {
      readonly metadata: { readonly scenario: string };
      readonly performance: { readonly tickCount: number };
    };

    expect(persisted.metadata.scenario).toBe(scenario);
    expect(persisted.performance.tickCount).toBe(tickCount);
  });

  it('retains scenario labels that look falsy after trimming', () => {
    const scenario = '0';
    const report = generateSeedToHarvestReport({ scenario });

    expect(report.metadata.scenario).toBe(scenario);
  });
});
