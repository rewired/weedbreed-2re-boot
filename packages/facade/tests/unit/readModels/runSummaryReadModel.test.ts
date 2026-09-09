/* eslint-disable wb-sim/no-ts-import-js-extension */

import {
  createDemoScenario,
  selectF1Candidate,
  startF1BreedingRun,
  type EconomyLedgerEntry,
  type Plant,
  type SimulationWorld,
} from '@wb/engine';
import { describe, expect, it } from 'vitest';
import { mapRunSummaryReadModel } from '../../../src/readModels/runSummary/index.js';

const NL = '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7';
const SD = '8b9a0b6c-2d6c-4f58-9c37-7a6c9d4aa5c2';
const CROSS = '70000000-0000-4000-8000-000000000001';
const SELECT = '70000000-0000-4000-8000-000000000002';
const LOT_A = '70000000-0000-4000-8000-000000000003';
const LOT_B = '70000000-0000-4000-8000-000000000004';

function selectedWorld(): { world: SimulationWorld; f1Id: string; runId: string } {
  const base = createDemoScenario({ companyName: 'Run Summary', seed: 'run-summary' });
  const qualified = { ...base, breeding: { ...base.breeding!, qualifiedParents: [
    { strainId: NL, lotId: LOT_A, harvestIntentId: LOT_A, quality01: 0.8, qualifiedAtSimTimeHours: 10 },
    { strainId: SD, lotId: LOT_B, harvestIntentId: LOT_B, quality01: 0.9, qualifiedAtSimTimeHours: 20 },
  ] } };
  const lab = qualified.company.structures.flatMap((structure) => structure.rooms)
    .find((room) => room.purpose === 'laboratory')!.id;
  const started = startF1BreedingRun(qualified, {
    intentId: CROSS, laboratoryRoomId: lab, seedParentId: NL, pollenParentId: SD, populationSize: 4,
  });
  if (!started.ok) throw new Error(started.message);
  const f1Id = started.run.candidates[0]!.id;
  const selected = selectF1Candidate(started.world, {
    intentId: SELECT, runId: started.run.id, candidateId: f1Id, name: 'Summary F1',
  });
  if (!selected.ok) throw new Error(selected.message);
  return { world: selected.world, f1Id, runId: selected.run.id };
}

function terminalPlant(template: Plant | undefined, id: string, strainId: string, options: {
  biomassG: number; quality01: number; ageHours: number; harvestedAt: number;
}): Plant {
  if (!template) throw new Error('Plant template missing.');
  return {
    ...template, id, slug: `plant-${id.slice(0, 8)}`, name: id, strainId,
    biomass_g: options.biomassG, quality01: options.quality01, ageHours: options.ageHours,
    status: 'harvested', readyForHarvest: false, harvestedAt_tick: options.harvestedAt,
  };
}

describe('R-700 run-summary projection', () => {
  it('is locked before candidate selection and in progress before a real F1 harvest', () => {
    const base = createDemoScenario({ companyName: 'Locked', seed: 'locked-summary' });
    expect(mapRunSummaryReadModel(base)).toMatchObject({
      status: 'locked', completed: false, completedAtSimTimeHours: null, entries: [],
    });
    const selected = selectedWorld();
    const summary = mapRunSummaryReadModel(selected.world);
    expect(summary.status).toBe('in-progress');
    expect(summary.completed).toBe(false);
    expect(summary.entries.map((entry) => entry.role)).toEqual(['seed-parent', 'pollen-parent', 'selected-f1']);
    expect(summary.entries[2]!.actual).toBeNull();
  });

  it('completes only from terminal F1 evidence and separates direct margin from shared OpEx', () => {
    const selected = selectedWorld();
    const structure = selected.world.company.structures[0]!;
    const room = structure.rooms.find((entry) => entry.purpose === 'growroom')!;
    const zone = room.zones[0]!;
    const template = zone.plants[0] ?? ({
      id: LOT_A, slug: 'template', name: 'Template', strainId: NL, lifecycleStage: 'harvest-ready',
      ageHours: 1, health01: 1, biomass_g: 1, containerId: zone.containerId,
      substrateId: zone.substrateId, status: 'active', quality01: 1,
    } satisfies Plant);
    const plants = [
      terminalPlant(template, '71000000-0000-4000-8000-000000000001', NL, { biomassG: 100, quality01: 0.8, ageHours: 2000, harvestedAt: 100 }),
      terminalPlant(template, '71000000-0000-4000-8000-000000000002', SD, { biomassG: 140, quality01: 0.7, ageHours: 2500, harvestedAt: 200 }),
      terminalPlant(template, '71000000-0000-4000-8000-000000000003', selected.f1Id, { biomassG: 160, quality01: 0.9, ageHours: 2100, harvestedAt: 300 }),
    ];
    const ledger = [
      { id: '72000000-0000-4000-8000-000000000001', category: 'seed', direction: 'debit', amountCc: 10, balanceAfterCc: 90, occurredAtSimTimeHours: 1, referenceId: zone.id, description: 'seed', metadata: { strainId: NL, quantity: 1, unitPriceCc: 10 } },
      { id: '72000000-0000-4000-8000-000000000002', category: 'sale', direction: 'credit', amountCc: 30, balanceAfterCc: 120, occurredAtSimTimeHours: 2, referenceId: LOT_A, description: 'sale', metadata: { strainId: NL } },
      { id: '72000000-0000-4000-8000-000000000003', category: 'operating_expense', direction: 'debit', amountCc: 7, balanceAfterCc: 113, occurredAtSimTimeHours: 3, referenceId: 'tick:3', description: 'shared opex' },
      { id: '72000000-0000-4000-8000-000000000004', category: 'capital_expenditure', direction: 'debit', amountCc: 5, balanceAfterCc: 108, occurredAtSimTimeHours: 4, referenceId: 'device', description: 'capex' },
    ] satisfies EconomyLedgerEntry[];
    const world: SimulationWorld = {
      ...selected.world,
      company: { ...selected.world.company, structures: selected.world.company.structures.map((candidate) =>
        candidate.id === structure.id ? { ...candidate, rooms: candidate.rooms.map((candidateRoom) =>
          candidateRoom.id === room.id ? { ...candidateRoom, zones: candidateRoom.zones.map((candidateZone) =>
            candidateZone.id === zone.id ? { ...candidateZone, plants } : candidateZone) } : candidateRoom) } : candidate) },
      economy: { ...selected.world.economy!, ledger },
    };
    const summary = mapRunSummaryReadModel(world);
    expect(summary).toMatchObject({
      status: 'completed', completed: true, completedAtSimTimeHours: 300,
      breedingRunId: selected.runId, unallocatedOperatingExpenseCc: 7,
      overallCycleContributionMarginCc: 8,
    });
    expect(summary.entries[0]!.actual).toMatchObject({
      harvestedFreshWeightG: 100, averageQuality01: 0.8,
      averageCycleDurationHours: 2000, realizedDirectMarginCc: 20,
    });
    expect(summary.entries[2]!.actual).toMatchObject({
      harvestedFreshWeightG: 160, realizedDirectMarginCc: 0, saleStatus: 'not-sold',
    });
    expect(summary.entries[2]!.blueprintPotential.yieldPotentialGPerPlant).toBeGreaterThan(0);
  });
});
