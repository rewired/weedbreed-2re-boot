/* eslint-disable wb-sim/no-ts-import-js-extension */
import { createDemoScenario, createEngineBootstrapConfig, type SimulationWorld } from '@wb/engine';
import { describe, expect, it, vi } from 'vitest';
import { io as createClient } from 'socket.io-client';
import { createReadModelProviders } from '../../../src/server/readModelProviders.js';
import { INTENT_EVENT, type TransportAck } from '../../../src/transport/adapter.js';
import { startFacadeDevServer } from '../../../src/transport/devServer.js';
import { createEngineCommandPipeline } from '../../../src/transport/engineCommandPipeline.js';
import { onceConnected } from './helpers.js';

const NL = '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7';
const SD = '8b9a0b6c-2d6c-4f58-9c37-7a6c9d4aa5c2';
const CROSS = '61000000-0000-4000-8000-000000000001';
const SELECT = '61000000-0000-4000-8000-000000000002';
const LOT_A = '61000000-0000-4000-8000-000000000003';
const LOT_B = '61000000-0000-4000-8000-000000000004';
const LED = '3b5f6ad7-672e-47cd-9a24-f0cc45c4101e';
const COOL_AIR = '7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b';
const SOW = '61000000-0000-4000-8000-000000000005';

function qualifiedWorld(): SimulationWorld {
  const world = createDemoScenario({ companyName: 'Facade Breeding', seed: 'facade-breeding' });
  return { ...world, breeding: { ...world.breeding!, qualifiedParents: [
    { strainId: NL, lotId: LOT_A, harvestIntentId: LOT_A, quality01: 0.8, qualifiedAtSimTimeHours: 1 },
    { strainId: SD, lotId: LOT_B, harvestIntentId: LOT_B, quality01: 0.9, qualifiedAtSimTimeHours: 1 },
  ] } };
}

function harness(initialWorld = qualifiedWorld()) {
  let world = initialWorld;
  const set = vi.fn((next: SimulationWorld) => { world = next; });
  const pipeline = createEngineCommandPipeline({ world: { get: () => world, set } });
  const providers = createReadModelProviders({
    world: () => world, companyWorld: () => world.company,
    config: createEngineBootstrapConfig('game.new.v1'),
  });
  return {
    get world() { return world; },
    set,
    replaceWorld(next: SimulationWorld) { world = next; },
    pipeline,
    providers,
  };
}

function withNegativeBalance(world: SimulationWorld): SimulationWorld {
  if (!world.economy) throw new Error('Demo economy missing.');
  return { ...world, economy: { ...world.economy, balanceCc: -25 } };
}

async function readyFirstZone(subject: ReturnType<typeof harness>) {
  const structure = subject.world.company.structures[0]!;
  const room = structure.rooms.find((entry) => entry.purpose === 'growroom')!;
  const zone = room.zones[0]!;
  for (let index = 0; index < 7; index += 1) {
    await subject.pipeline.handle({
      type: 'device.purchaseInstall.v1',
      intentId: `62000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      structureId: structure.id, roomId: room.id, zoneId: zone.id, deviceBlueprintId: LED,
    });
  }
  await subject.pipeline.handle({
    type: 'device.purchaseInstall.v1', intentId: '62000000-0000-4000-8000-000000000010',
    structureId: structure.id, roomId: room.id, zoneId: zone.id, deviceBlueprintId: COOL_AIR,
  });
  return { structureId: structure.id, roomId: room.id, zoneId: zone.id };
}

async function submit(socket: ReturnType<typeof createClient>, payload: Record<string, unknown>): Promise<TransportAck> {
  return new Promise((resolve) => socket.emit(INTENT_EVENT, payload, resolve));
}

describe('R-601 breeding intents and projection', () => {
  it('creates four candidates, replays without duplication, selects one, and exposes the custom strain', async () => {
    const subject = harness();
    const laboratoryRoomId = subject.world.company.structures.flatMap((entry) => entry.rooms).find((room) => room.purpose === 'laboratory')!.id;
    const cross = { type: 'breeding.crossF1.v1', intentId: CROSS, laboratoryRoomId, seedParentId: NL, pollenParentId: SD, populationSize: 4 } as const;
    const first = await subject.pipeline.handle(cross);
    const replay = await subject.pipeline.handle(cross);
    expect(first).toMatchObject({ ok: true, result: { command: 'breeding.crossF1', replayed: false } });
    expect(replay).toMatchObject({ ok: true, result: { replayed: true } });
    expect(subject.world.breeding?.runs).toHaveLength(1);
    const run = subject.world.breeding!.runs[0]!;
    const candidateId = run.candidates[0]!.id;
    const selected = await subject.pipeline.handle({
      type: 'breeding.selectCandidate.v1', intentId: SELECT, runId: run.id, candidateId, name: 'Aurora Diesel',
    });
    expect(selected).toMatchObject({ ok: true, result: { selectedCandidateId: candidateId, customStrainId: candidateId } });
    expect(subject.world.breeding?.customStrainRegistry).toHaveLength(1);

    const snapshot = await subject.providers.readModels();
    expect(snapshot.breeding.qualifiedParents).toHaveLength(2);
    expect(snapshot.breeding.crossEligibility).toEqual({ eligible: true, reasons: [] });
    expect(snapshot.breeding.laboratory?.roomId).toBe(laboratoryRoomId);
    expect(snapshot.breeding.runs[0]).toMatchObject({
      status: 'selected', selectedCandidateId: candidateId,
      customStrain: { strainId: candidateId, name: 'Aurora Diesel', slug: 'aurora-diesel' },
    });
    expect(snapshot.breeding.runs[0]!.parents.map((parent) => parent.role)).toEqual(['seed', 'pollen']);
    const projectedRun = snapshot.breeding.runs[0]!;
    const projectedCandidate = projectedRun.candidates[0]!;
    expect(Object.keys(projectedCandidate.traits).sort()).toEqual(Object.keys(projectedRun.parents[0]!.traits).sort());
    const parentYieldMean = projectedRun.parents.reduce(
      (sum, parent) => sum + parent.traits.yieldPotentialGPerPlant,
      0,
    ) / 2;
    expect(projectedCandidate.deltaFromParentMean.yieldPotentialGPerPlant).toBeCloseTo(
      projectedCandidate.traits.yieldPotentialGPerPlant - parentYieldMean,
      6,
    );
    const zone = snapshot.structures.flatMap((structure) => structure.rooms).flatMap((room) => room.zones)[0]!;
    expect(zone.strainChoices).toContainEqual(expect.objectContaining({ strainId: candidateId, seedPriceCc: 0 }));

    const sowTarget = await readyFirstZone(subject);
    subject.replaceWorld(withNegativeBalance(subject.world));
    const sowAck = await subject.pipeline.handle({
      type: 'plants.sow.v1', intentId: SOW, ...sowTarget, strainId: candidateId, count: 1,
    });
    expect(sowAck).toMatchObject({
      ok: true,
      result: {
        command: 'plants.sow', strainId: candidateId, count: 1,
        seedCost: { unitPriceCc: 0, amountCc: 0, booking: 'booked' },
      },
    });
    const sownZone = subject.world.company.structures[0]!.rooms
      .find((room) => room.id === sowTarget.roomId)!.zones.find((entry) => entry.id === sowTarget.zoneId)!;
    expect(sownZone.plants.at(-1)).toMatchObject({ strainId: candidateId, status: 'active' });
    await subject.pipeline.handle({
      type: 'plants.sow.v1', intentId: SOW, ...sowTarget, strainId: candidateId, count: 1,
    });
    expect(subject.world.economy?.ledger.filter((entry) => entry.intentId === SOW)).toHaveLength(1);
  });

  it('surfaces authoritative laboratory, qualification, conflict, and selection errors', async () => {
    const subject = harness();
    const lab = subject.world.company.structures.flatMap((entry) => entry.rooms).find((room) => room.purpose === 'laboratory')!.id;
    await expect(subject.pipeline.handle({ type: 'breeding.crossF1.v1', intentId: CROSS, laboratoryRoomId: LOT_A, seedParentId: NL, pollenParentId: SD, populationSize: 4 })).rejects.toThrow('invalid-laboratory');
    const unqualified = harness(createDemoScenario({ companyName: 'Unqualified', seed: 'unqualified' }));
    const unqualifiedLab = unqualified.world.company.structures.flatMap((entry) => entry.rooms).find((room) => room.purpose === 'laboratory')!.id;
    await expect(unqualified.pipeline.handle({ type: 'breeding.crossF1.v1', intentId: CROSS, laboratoryRoomId: unqualifiedLab, seedParentId: NL, pollenParentId: SD, populationSize: 4 })).rejects.toThrow('parent-not-qualified');
    await subject.pipeline.handle({ type: 'breeding.crossF1.v1', intentId: CROSS, laboratoryRoomId: lab, seedParentId: NL, pollenParentId: SD, populationSize: 4 });
    await expect(subject.pipeline.handle({ type: 'breeding.crossF1.v1', intentId: CROSS, laboratoryRoomId: lab, seedParentId: SD, pollenParentId: NL, populationSize: 4 })).rejects.toThrow('intent-conflict');
    const run = subject.world.breeding!.runs[0]!;
    await expect(subject.pipeline.handle({ type: 'breeding.selectCandidate.v1', intentId: SELECT, runId: run.id, candidateId: run.candidates[0]!.id, name: 'Northern Lights' })).rejects.toThrow('strain-collision');
    await subject.pipeline.handle({ type: 'breeding.selectCandidate.v1', intentId: SELECT, runId: run.id, candidateId: run.candidates[0]!.id, name: 'Chosen One' });
    const replay = await subject.pipeline.handle({ type: 'breeding.selectCandidate.v1', intentId: SELECT, runId: run.id, candidateId: run.candidates[0]!.id, name: 'Chosen One' });
    expect(replay).toMatchObject({ ok: true, result: { replayed: true } });
    await expect(subject.pipeline.handle({ type: 'breeding.selectCandidate.v1', intentId: SELECT, runId: run.id, candidateId: run.candidates[0]!.id, name: 'Renamed' })).rejects.toThrow('intent-conflict');
    await expect(subject.pipeline.handle({ type: 'breeding.selectCandidate.v1', intentId: LOT_A, runId: run.id, candidateId: run.candidates[1]!.id, name: 'Other' })).rejects.toThrow('already-selected');
  });

  it('serializes Cross, Select, and free Custom Sow through the real Socket transport', async () => {
    const prepared = harness();
    const sowTarget = await readyFirstZone(prepared);
    const lab = prepared.world.company.structures.flatMap((entry) => entry.rooms)
      .find((room) => room.purpose === 'laboratory')!.id;
    const devServer = await startFacadeDevServer({
      host: '127.0.0.1', port: 0, world: withNegativeBalance(prepared.world),
    });
    const socket = createClient(`${devServer.server.url}/intents`, { transports: ['websocket'], forceNew: true });
    try {
      await onceConnected(socket);
      const cross = await submit(socket, {
        type: 'breeding.crossF1.v1', intentId: CROSS, laboratoryRoomId: lab,
        seedParentId: NL, pollenParentId: SD, populationSize: 4,
      });
      expect(cross).toMatchObject({ ok: true, result: { command: 'breeding.crossF1' } });
      const crossResult = (cross as TransportAck & {
        readonly result: { readonly runId: string; readonly candidateIds: readonly string[] };
      }).result;
      const candidateId = crossResult.candidateIds[0]!;
      const selected = await submit(socket, {
        type: 'breeding.selectCandidate.v1', intentId: SELECT,
        runId: crossResult.runId, candidateId, name: 'Ramp One',
      });
      expect(selected).toMatchObject({ ok: true, result: { customStrainId: candidateId } });
      const sow = await submit(socket, {
        type: 'plants.sow.v1', intentId: SOW, ...sowTarget, strainId: candidateId, count: 1,
      });
      expect(sow).toMatchObject({
        ok: true,
        result: { command: 'plants.sow', strainId: candidateId, seedCost: { unitPriceCc: 0, amountCc: 0 } },
      });
    } finally {
      socket.disconnect();
      await devServer.stop();
    }
  });
});
