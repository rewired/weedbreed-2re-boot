import { describe, expect, it } from 'vitest';

import {
  EPS_ABS,
  createDemoScenario,
  crossF1,
  executeInventorySell,
  resolveStrain,
  selectF1Candidate,
  startF1BreedingRun,
  type HarvestLot,
  type SimulationWorld,
  type Uuid,
} from '@wb/engine';
import { deterministicUuid } from '@/backend/src/util/uuid';

const NORTHERN_LIGHTS_ID = '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7' as Uuid;
const SOUR_DIESEL_ID = '8b9a0b6c-2d6c-4f58-9c37-7a6c9d4aa5c2' as Uuid;

function id(label: string): Uuid { return deterministicUuid('breeding-tests', label); }

function withParentLots(world: SimulationWorld): SimulationWorld {
  const structure = world.company.structures[0]!;
  const storage = structure.rooms.find((room) => room.purpose === 'storageroom')!;
  const zone = structure.rooms.find((room) => room.purpose === 'growroom')!.zones[0]!;
  const lots: HarvestLot[] = [NORTHERN_LIGHTS_ID, SOUR_DIESEL_ID].map((strainId, index) => ({
    id: id(`lot-${String(index)}`), structureId: structure.id, roomId: storage.id, strainId,
    source: { plantId: id(`plant-${String(index)}`), zoneId: zone.id, harvestIntentId: id(`harvest-${String(index)}`) },
    freshWeight_kg: 1, moisture01: 0.5, quality01: 0.8, createdAt_tick: index + 10,
  }));
  return { ...world, company: { ...world.company, structures: [{ ...structure, rooms: structure.rooms.map((room) => room.id === storage.id ? { ...room, inventory: { lots } } : room) }] } };
}

function crossCommand(world: SimulationWorld) {
  const laboratoryRoomId = world.company.structures[0]!.rooms.find((room) => room.purpose === 'laboratory')!.id;
  return { intentId: id('cross'), laboratoryRoomId, seedParentId: NORTHERN_LIGHTS_ID, pollenParentId: SOUR_DIESEL_ID, populationSize: 4 as const };
}

describe('R-600 F1 breeding domain', () => {
  it('generates a schema-valid deterministic golden population with normalized values and ordered ranges', () => {
    const world = createDemoScenario({ companyName: 'Breeding', seed: 'golden-f1' });
    const seedParent = resolveStrain(world, NORTHERN_LIGHTS_ID)!.blueprint;
    const pollenParent = resolveStrain(world, SOUR_DIESEL_ID)!.blueprint;
    const input = { worldSeed: world.seed, runId: id('golden-run'), seedParent, pollenParent, populationSize: 4 as const };
    const first = crossF1(input);
    expect(crossF1(input)).toStrictEqual(first);
    expect(first).toHaveLength(4);
    expect(first.map((candidate) => ({ id: candidate.id, genotype: candidate.blueprint.genotype, resilience: candidate.blueprint.generalResilience }))).toMatchInlineSnapshot(`
      [
        {
          "genotype": {
            "indica": 0.368002461224,
            "ruderalis": 0.004181050251,
            "sativa": 0.627816488525,
          },
          "id": "74868b63-342c-4c0e-a108-da921316e932",
          "resilience": 0.667809685282,
        },
        {
          "genotype": {
            "indica": 0.332959516941,
            "ruderalis": 0,
            "sativa": 0.667040483059,
          },
          "id": "fbfaf4e5-133a-4bbd-8c6c-cdb1b9e9b431",
          "resilience": 0.709325465504,
        },
        {
          "genotype": {
            "indica": 0.33822386796,
            "ruderalis": 0.034477263574,
            "sativa": 0.627298868466,
          },
          "id": "a0879461-deb3-4703-943f-f8b9b61e259e",
          "resilience": 0.729756034538,
        },
        {
          "genotype": {
            "indica": 0.372108857578,
            "ruderalis": 0,
            "sativa": 0.627891142422,
          },
          "id": "995e0ae5-dcba-465b-84a9-7db6a906c381",
          "resilience": 0.678846549485,
        },
      ]
    `);
    for (const candidate of first) {
      expect(Math.abs(Object.values(candidate.blueprint.genotype ?? {}).reduce((sum, value) => sum + value, 0) - 1)).toBeLessThanOrEqual(EPS_ABS);
      expect(candidate.blueprint.generalResilience).toBeGreaterThanOrEqual(0);
      expect(candidate.blueprint.generalResilience).toBeLessThanOrEqual(1);
      for (const phase of Object.values(candidate.blueprint.envBands)) {
        for (const range of Object.values(phase ?? {})) {
          expect(range.green[0]).toBeLessThan(range.green[1]);
          expect(range.yellowLow).toBeLessThan(range.green[0]);
          expect(range.yellowHigh).toBeGreaterThan(range.green[1]);
        }
      }
    }
  });

  it('models parent order explicitly as seed and pollen roles', () => {
    const world = createDemoScenario({ companyName: 'Breeding', seed: 'role-order' });
    const a = resolveStrain(world, NORTHERN_LIGHTS_ID)!.blueprint;
    const b = resolveStrain(world, SOUR_DIESEL_ID)!.blueprint;
    const direct = crossF1({ worldSeed: world.seed, runId: id('roles'), seedParent: a, pollenParent: b, populationSize: 3 });
    const reverse = crossF1({ worldSeed: world.seed, runId: id('roles'), seedParent: b, pollenParent: a, populationSize: 3 });
    expect((direct[0]!.blueprint.lineage as { roles: object }).roles).toEqual({ seedParentId: a.id, pollenParentId: b.id });
    expect((reverse[0]!.blueprint.lineage as { roles: object }).roles).toEqual({ seedParentId: b.id, pollenParentId: a.id });
    expect(reverse).not.toStrictEqual(direct);
  });

  it('requires two distinct qualified parents and a real laboratory, then replays without mutation', () => {
    const empty = createDemoScenario({ companyName: 'Breeding', seed: 'start-run' });
    const command = crossCommand(empty);
    expect(startF1BreedingRun(empty, command)).toMatchObject({ ok: false, code: 'parent-not-qualified' });
    expect(startF1BreedingRun(withParentLots(empty), { ...command, pollenParentId: NORTHERN_LIGHTS_ID })).toMatchObject({ ok: false, code: 'same-parent' });
    expect(startF1BreedingRun(withParentLots(empty), { ...command, laboratoryRoomId: id('missing-lab') })).toMatchObject({ ok: false, code: 'invalid-laboratory' });
    const first = startF1BreedingRun(withParentLots(empty), command);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.run).toMatchObject({ laboratoryRoomId: command.laboratoryRoomId, seedParentId: NORTHERN_LIGHTS_ID, pollenParentId: SOUR_DIESEL_ID, populationSize: 4, status: 'candidates-generated' });
    expect(startF1BreedingRun(first.world, command)).toEqual({ ok: true, world: first.world, run: first.run, replayed: true });
  });

  it('selects exactly one candidate, preserves history, registers it, and supports free retained-stock sowing resolution', () => {
    const started = startF1BreedingRun(withParentLots(createDemoScenario({ companyName: 'Breeding', seed: 'select-run' })), crossCommand(createDemoScenario({ companyName: 'Breeding', seed: 'select-run' })));
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const candidate = started.run.candidates[1]!;
    const input = { intentId: id('select'), runId: started.run.id, candidateId: candidate.id, name: 'Aurora Diesel' };
    const selected = selectF1Candidate(started.world, input);
    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    expect(selected.run.candidates).toStrictEqual(started.run.candidates);
    expect(selected.world.breeding?.customStrainRegistry[0]).toMatchObject({ id: candidate.id, name: 'Aurora Diesel', slug: 'aurora-diesel' });
    expect(resolveStrain(selected.world, candidate.id)).toMatchObject({ source: 'custom' });
    expect(selectF1Candidate(selected.world, input)).toEqual({ ok: true, world: selected.world, run: selected.run, replayed: true });
    expect(selectF1Candidate(selected.world, { ...input, intentId: id('select-again') })).toMatchObject({ ok: false, code: 'already-selected' });
  });

  it('keeps qualification evidence after a complete sale', () => {
    const world = withParentLots(createDemoScenario({ companyName: 'Breeding', seed: 'sold-parent' }));
    const withEvidence = { ...world, breeding: { ...world.breeding!, qualifiedParents: [
      { strainId: NORTHERN_LIGHTS_ID, lotId: id('lot-0'), harvestIntentId: id('harvest-0'), quality01: 0.8, qualifiedAtSimTimeHours: 10 },
      { strainId: SOUR_DIESEL_ID, lotId: id('lot-1'), harvestIntentId: id('harvest-1'), quality01: 0.8, qualifiedAtSimTimeHours: 11 },
    ] } };
    const soldA = executeInventorySell(withEvidence, { intentId: id('sale-a'), lotId: id('lot-0'), fraction01: 1 });
    expect(soldA.ok).toBe(true);
    if (!soldA.ok) return;
    const soldB = executeInventorySell(soldA.world, { intentId: id('sale-b'), lotId: id('lot-1'), fraction01: 1 });
    expect(soldB.ok).toBe(true);
    if (!soldB.ok) return;
    expect(startF1BreedingRun(soldB.world, crossCommand(soldB.world))).toMatchObject({ ok: true });
  });
});
