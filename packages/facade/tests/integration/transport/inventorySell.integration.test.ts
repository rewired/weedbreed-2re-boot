/* eslint-disable wb-sim/no-ts-import-js-extension */
import { describe, expect, it, vi } from 'vitest';

import {
  createDemoScenario,
  createEngineBootstrapConfig,
  type Plant,
  type SimulationWorld,
} from '@wb/engine';
import { createReadModelProviders } from '../../../src/server/readModelProviders.js';
import { createEngineCommandPipeline } from '../../../src/transport/engineCommandPipeline.js';

const PLANT_ID = '72000000-0000-4000-8000-000000000001';
const HARVEST_INTENT_ID = '73000000-0000-4000-8000-000000000001';
const SALE_INTENT_ID = '74000000-0000-4000-8000-000000000001';
const SECOND_SALE_INTENT_ID = '74000000-0000-4000-8000-000000000002';
const NORTHERN_LIGHTS_ID = '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7';

function withReadyPlant(): SimulationWorld {
  const world = createDemoScenario({ companyName: 'Lot Sale', seed: 'lot-sale' });
  const structure = world.company.structures[0];
  const room = structure?.rooms.find((entry) => entry.purpose === 'growroom');
  const zone = room?.zones[0];
  if (!structure || !room || !zone) throw new Error('Demo sale targets missing.');
  const plant = {
    id: PLANT_ID,
    slug: 'ready-northern-lights',
    name: 'Ready Northern Lights',
    strainId: NORTHERN_LIGHTS_ID,
    lifecycleStage: 'harvest-ready',
    ageHours: 2208,
    health01: 0.9,
    biomass_g: 120,
    containerId: zone.containerId,
    substrateId: zone.substrateId,
    readyForHarvest: true,
    status: 'active',
    moisture01: 0.64,
    quality01: 0.82,
  } satisfies Plant;
  return {
    ...world,
    simTimeHours: 2208,
    company: {
      ...world.company,
      structures: world.company.structures.map((candidate) => candidate.id === structure.id ? {
        ...candidate,
        rooms: candidate.rooms.map((candidateRoom) => candidateRoom.id === room.id ? {
          ...candidateRoom,
          zones: candidateRoom.zones.map((candidateZone) =>
            candidateZone.id === zone.id ? { ...candidateZone, plants: [plant] } : candidateZone),
        } : candidateRoom),
      } : candidate),
    },
  };
}

function createHarness() {
  let world = withReadyPlant();
  const set = vi.fn((next: SimulationWorld) => { world = next; });
  const pipeline = createEngineCommandPipeline({ world: { get: () => world, set } });
  const providers = createReadModelProviders({
    world: () => world,
    companyWorld: () => world.company,
    config: createEngineBootstrapConfig('demo'),
  });
  return { get world() { return world; }, set, pipeline, providers };
}

async function harvest(harness: ReturnType<typeof createHarness>): Promise<string> {
  const structure = harness.world.company.structures[0]!;
  const room = structure.rooms.find((entry) => entry.purpose === 'growroom')!;
  const zone = room.zones[0]!;
  const acknowledgement = await harness.pipeline.handle({
    type: 'plants.harvest.v1', intentId: HARVEST_INTENT_ID,
    structureId: structure.id, roomId: room.id, zoneId: zone.id, plantIds: [PLANT_ID],
  });
  if (!acknowledgement || !('result' in acknowledgement)) throw new Error('Harvest ack missing.');
  return (acknowledgement.result as { lotIds: readonly string[] }).lotIds[0]!;
}

describe('R-501 inventory.sell.v1', () => {
  it('sells exactly 50%, books one credit and projects balance, formula and remainder', async () => {
    const harness = createHarness();
    const lotId = await harvest(harness);
    const before = await harness.providers.readModels();
    const beforeBalance = before.economy.balanceCc;
    const intent = {
      type: 'inventory.sell.v1', intentId: SALE_INTENT_ID, lotId, fraction01: 0.5,
    } as const;

    const first = await harness.pipeline.handle(intent);
    const second = await harness.pipeline.handle(intent);

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      ok: true,
      result: {
        command: 'inventory.sell', lotId, replayed: false,
        balanceBeforeCc: beforeBalance,
        balanceAfterCc: 20088.452,
      },
    });
    const quote = (first as { result: { quote: {
      fraction01: number; soldFreshWeightKg: number; soldDryWeightKg: number;
      priceCcPerDryGram: number; qualityFactor: number; proceedsCc: number;
    } } }).result.quote;
    expect(quote.fraction01).toBe(0.5);
    expect(quote.soldFreshWeightKg).toBeCloseTo(0.06, 9);
    expect(quote.soldDryWeightKg).toBeCloseTo(0.0216, 9);
    expect(quote.priceCcPerDryGram).toBe(4.5);
    expect(quote.qualityFactor).toBeCloseTo(0.91, 9);
    expect(quote.proceedsCc).toBeCloseTo(88.452, 9);
    expect(harness.set).toHaveBeenCalledTimes(2);

    const after = await harness.providers.readModels();
    expect(after.inventory.lots).toHaveLength(1);
    expect(after.inventory.lots[0]).toMatchObject({
      lotId, strainId: NORTHERN_LIGHTS_ID,
      freshWeightKg: 0.06, remainingFreshWeightKg: 0.06, remainingDryWeightKg: 0.0216,
      salePreview: {
        fraction01: 0.5, soldFreshWeightKg: 0.03, soldDryWeightKg: 0.0108,
        priceCcPerDryGram: 4.5, proceedsCc: 44.226,
      },
    });
    expect(after.inventory.lots[0]?.salePreview?.qualityFactor).toBeCloseTo(0.91, 9);
    expect(after.economy.balanceCc).toBe(20088.452);
    expect(after.economy.cycleContributionMarginCc).toBe(88.452);
    expect(after.economy.ledger.filter((entry) => entry.category === 'sale')).toHaveLength(1);
    expect(after.economy.ledger.at(-1)).toMatchObject({
      id: (first as { result: { ledgerEntryId: string } }).result.ledgerEntryId,
      intentId: SALE_INTENT_ID,
      direction: 'credit',
      balanceAfterCc: 20088.452,
      referenceId: lotId,
    });
    expect(after.economy.ledger.at(-1)?.amountCc).toBeCloseTo(88.452, 9);

    await expect(harness.pipeline.handle({ ...intent, fraction01: 1 }))
      .rejects.toThrow(/different payload/i);
  });

  it('rejects an invalid fraction and a second sale after the full remainder is gone', async () => {
    const harness = createHarness();
    const lotId = await harvest(harness);
    await expect(harness.pipeline.handle({
      type: 'inventory.sell.v1', intentId: SALE_INTENT_ID, lotId, fraction01: 1.01,
    })).rejects.toThrow(/payload failed validation/i);
    await harness.pipeline.handle({
      type: 'inventory.sell.v1', intentId: SALE_INTENT_ID, lotId, fraction01: 1,
    });
    const afterFullSale = harness.world;
    await expect(harness.pipeline.handle({
      type: 'inventory.sell.v1', intentId: SECOND_SALE_INTENT_ID, lotId, fraction01: 1,
    })).rejects.toThrow(/lot_not_found: Harvest lot does not exist or has already been sold/i);
    expect(harness.world).toBe(afterFullSale);
    expect(harness.world.economy?.ledger.filter((entry) => entry.category === 'sale')).toHaveLength(1);
  });
});
