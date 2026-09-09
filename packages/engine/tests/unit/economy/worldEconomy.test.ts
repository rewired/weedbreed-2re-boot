import { describe, expect, it } from 'vitest';

import {
  createDemoScenario,
  DEMO_STARTING_BALANCE_CC,
  executeDevicePurchaseInstall,
  executeInventorySell,
  quoteHarvestSale,
  runTick,
  type HarvestLot,
  type SimulationWorld,
} from '@wb/engine';
import { deterministicUuid } from '@/backend/src/util/uuid';

const LIGHT_BLUEPRINT_ID = '3b5f6ad7-672e-47cd-9a24-f0cc45c4101e';
const NORTHERN_LIGHTS_ID = '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7';

function commandId(label: string) {
  return deterministicUuid('world-economy-tests', label);
}

function withLot(world: SimulationWorld, lot: HarvestLot): SimulationWorld {
  const structure = world.company.structures[0];
  const storage = structure.rooms.find((room) => room.purpose === 'storageroom');
  if (!storage) throw new Error('Demo storage is required.');
  return {
    ...world,
    company: {
      ...world.company,
      structures: [{
        ...structure,
        rooms: structure.rooms.map((room) => room.id === storage.id
          ? { ...room, inventory: { lots: [lot] } }
          : room),
      }],
    },
  };
}

function demoLot(world: SimulationWorld): HarvestLot {
  const structure = world.company.structures[0];
  const storage = structure.rooms.find((room) => room.purpose === 'storageroom');
  const growroom = structure.rooms.find((room) => room.purpose === 'growroom');
  const zone = growroom?.zones[0];
  if (!storage || !zone) throw new Error('Demo rooms are required.');
  return {
    id: commandId('lot'),
    structureId: structure.id,
    roomId: storage.id,
    strainId: NORTHERN_LIGHTS_ID,
    source: { plantId: commandId('plant'), zoneId: zone.id, harvestIntentId: commandId('harvest') },
    freshWeight_kg: 1,
    moisture01: 0.6,
    quality01: 0.8,
    createdAt_tick: 100,
  };
}

describe('persistent world economy', () => {
  it('initialises the canonical game with a deterministic opening balance', () => {
    const first = createDemoScenario({ companyName: 'Economy', seed: 'economy-seed' });
    const second = createDemoScenario({ companyName: 'Economy', seed: 'economy-seed' });

    expect(first.economy).toEqual({
      startingBalanceCc: DEMO_STARTING_BALANCE_CC,
      balanceCc: DEMO_STARTING_BALANCE_CC,
      ledger: [],
    });
    expect(second.economy).toStrictEqual(first.economy);
  });

  it('uses the documented dry-weight and quality formula', () => {
    expect(quoteHarvestSale({
      freshWeightKg: 1,
      moisture01: 0.6,
      quality01: 0.8,
      fraction01: 0.5,
      priceCcPerDryGram: 4.5,
    })).toEqual({
      fraction01: 0.5,
      soldFreshWeightKg: 0.5,
      soldDryWeightKg: 0.2,
      priceCcPerDryGram: 4.5,
      qualityFactor: 0.9,
      proceedsCc: 810,
    });
  });

  it('partially sells a lot, preserves its origin, and replays without double credit', () => {
    const start = createDemoScenario({ companyName: 'Economy', seed: 'sale-seed' });
    const lot = demoLot(start);
    const world = withLot(start, lot);
    const command = { intentId: commandId('sale'), lotId: lot.id, fraction01: 0.5 };
    const first = executeInventorySell(world, command);
    if (!first.ok) throw new Error(first.message);

    const remaining = first.world.company.structures[0].rooms
      .flatMap((room) => room.inventory?.lots ?? [])[0];
    expect(remaining).toMatchObject({
      id: lot.id,
      strainId: lot.strainId,
      source: lot.source,
      freshWeight_kg: 0.5,
    });
    expect(first.quote).toMatchObject({ soldDryWeightKg: 0.2, qualityFactor: 0.9, proceedsCc: 810 });
    expect(first.balanceAfterCc).toBe(DEMO_STARTING_BALANCE_CC + 810);
    expect(first.world.economy?.ledger).toEqual([
      expect.objectContaining({ category: 'sale', direction: 'credit', amountCc: 810 }),
    ]);

    const replay = executeInventorySell(first.world, command);
    expect(replay).toMatchObject({ ok: true, replayed: true, balanceAfterCc: first.balanceAfterCc });
    expect(replay.world).toBe(first.world);
    expect(executeInventorySell(first.world, { ...command, fraction01: 0.25 })).toMatchObject({
      ok: false, code: 'intent_conflict', world: first.world,
    });
  });

  it('rejects invalid fractions and discretionary purchases without funds', () => {
    const start = createDemoScenario({ companyName: 'Economy', seed: 'reject-seed' });
    const lot = demoLot(start);
    const world = withLot(start, lot);
    expect(executeInventorySell(world, {
      intentId: commandId('over-rest'), lotId: lot.id, fraction01: 1.01,
    })).toMatchObject({ ok: false, code: 'invalid_command', world });

    const structure = start.company.structures[0];
    const growroom = structure.rooms.find((room) => room.purpose === 'growroom');
    const zone = growroom?.zones[0];
    if (!growroom || !zone || !start.economy) throw new Error('Demo economy zone is required.');
    const poorWorld = { ...start, economy: { ...start.economy, balanceCc: 599 } };
    expect(executeDevicePurchaseInstall(poorWorld, {
      intentId: commandId('too-expensive'),
      structureId: structure.id,
      roomId: growroom.id,
      zoneId: zone.id,
      deviceBlueprintId: LIGHT_BLUEPRINT_ID,
    })).toMatchObject({ ok: false, code: 'insufficient_funds', world: poorWorld });
  });

  it('persists one aggregated OpEx debit for each tick', () => {
    const world = createDemoScenario({ companyName: 'Economy', seed: 'opex-seed' });
    const result = runTick(world, { tickDurationHours: 1 });
    const entry = result.world.economy?.ledger.at(-1);

    expect(entry).toMatchObject({ category: 'operating_expense', direction: 'debit' });
    expect(entry?.amountCc).toBeGreaterThan(0);
    expect(result.world.economy?.balanceCc).toBeCloseTo(
      DEMO_STARTING_BALANCE_CC - (entry?.amountCc ?? 0),
    );
  });
});
