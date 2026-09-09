import { describe, expect, it } from 'vitest';

import {
  createDemoScenario,
  executeDevicePurchaseInstall,
  executePlantsHarvest,
  executePlantsSow,
  resolveStrain,
  type SimulationWorld,
} from '@wb/engine';
import { deterministicUuid } from '@/backend/src/util/uuid';

const NORTHERN_LIGHTS_ID = '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7';
const SOUR_DIESEL_ID = '8b9a0b6c-2d6c-4f58-9c37-7a6c9d4aa5c2';
const LIGHT_BLUEPRINT_ID = '3b5f6ad7-672e-47cd-9a24-f0cc45c4101e';
const CLIMATE_BLUEPRINT_ID = '7d3d3f1a-8c6f-4e9c-926d-5a2a4a3b6f1b';
const LIGHT_COUNT_FOR_DEMO_ZONE = 7;

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;

function intentId(label: string): string {
  return deterministicUuid('plants-sow-tests', label);
}

function makeZoneReady(world: SimulationWorld, zoneIndex = 0): SimulationWorld {
  const structure = world.company.structures[0];
  const growroom = structure.rooms.find((room) => room.purpose === 'growroom');
  const zone = growroom?.zones[zoneIndex];
  if (!growroom || !zone) throw new Error('Demo growroom zone is required.');
  let current = world;
  const blueprintIds = [
    ...Array.from({ length: LIGHT_COUNT_FOR_DEMO_ZONE }, () => LIGHT_BLUEPRINT_ID),
    CLIMATE_BLUEPRINT_ID,
  ];

  blueprintIds.forEach((deviceBlueprintId, index) => {
    const result = executeDevicePurchaseInstall(current, {
      intentId: intentId(`ready:${String(zoneIndex)}:${String(index)}`),
      structureId: structure.id,
      roomId: growroom.id,
      zoneId: zone.id,
      deviceBlueprintId,
    });
    if (!result.ok) throw new Error(result.message);
    current = result.world;
  });

  return current;
}

function sowCommand(world: SimulationWorld, strainId = NORTHERN_LIGHTS_ID, count = 2) {
  const structure = world.company.structures[0];
  const growroom = structure.rooms.find((room) => room.purpose === 'growroom');
  const zone = growroom?.zones[0];
  if (!growroom || !zone) throw new Error('Demo growroom zone is required.');

  return {
    intentId: intentId('sow'),
    structureId: structure.id,
    roomId: growroom.id,
    zoneId: zone.id,
    strainId,
    count,
  };
}

describe('executePlantsSow', () => {
  it('resolves both demo parents with canonical maturity fields', () => {
    const world = createDemoScenario({ companyName: 'Parents', seed: 'resolver-seed' });
    const northernLights = resolveStrain(world, NORTHERN_LIGHTS_ID);
    const sourDiesel = resolveStrain(world, SOUR_DIESEL_ID);

    expect(northernLights).toMatchObject({
      source: 'static',
      blueprint: { name: 'Northern Lights', phaseDurations: { seedlingDays: 7, vegDays: 28, flowerDays: 50, ripeningDays: 7 } },
    });
    expect(sourDiesel).toMatchObject({
      source: 'static',
      blueprint: { name: 'Sour Diesel', phaseDurations: { seedlingDays: 12, vegDays: 36, flowerDays: 70, ripeningDays: 10 } },
    });
  });

  it('sows valid plants immutably with an explicitly booked seed cost', () => {
    const world = makeZoneReady(createDemoScenario({ companyName: 'Parents', seed: 'sow-seed' }));
    const command = sowCommand(world);
    const result = executePlantsSow(world, command);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(world.company.structures[0].rooms[0].zones[0].plants).toHaveLength(0);
    expect(result.plantIds).toHaveLength(2);
    expect(result.seedCost).toMatchObject({
      unitPriceCc: 0.7,
      quantity: 2,
      amountCc: 1.4,
      booking: 'booked',
    });
    expect(result.world.economy?.ledger.at(-1)).toMatchObject({
      category: 'seed', direction: 'debit', amountCc: 1.4,
      metadata: { strainId: NORTHERN_LIGHTS_ID, quantity: 2, unitPriceCc: 0.7 },
    });
    expect(result.world.company.structures[0].rooms[0].zones[0].plants).toEqual([
      expect.objectContaining({ id: result.plantIds[0], strainId: NORTHERN_LIGHTS_ID, lifecycleStage: 'seedling' }),
      expect.objectContaining({ id: result.plantIds[1], strainId: NORTHERN_LIGHTS_ID, lifecycleStage: 'seedling' }),
    ]);
  });

  it('supports Northern Lights and Sour Diesel simultaneously in separate zones', () => {
    let world = createDemoScenario({ companyName: 'Parents', seed: 'two-parent-seed' });
    world = makeZoneReady(makeZoneReady(world, 0), 1);
    const first = executePlantsSow(world, sowCommand(world, NORTHERN_LIGHTS_ID, 1));
    if (!first.ok) throw new Error(first.message);
    const structure = first.world.company.structures[0];
    const growroom = structure.rooms.find((room) => room.purpose === 'growroom');
    const secondZone = growroom?.zones[1];
    if (!growroom || !secondZone) throw new Error('Second demo zone is required.');
    const second = executePlantsSow(first.world, {
      intentId: intentId('sour-diesel-sow'),
      structureId: structure.id,
      roomId: growroom.id,
      zoneId: secondZone.id,
      strainId: SOUR_DIESEL_ID,
      count: 1,
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.seedCost.amountCc).toBe(0.8);
    expect(second.world.company.structures[0].rooms[0].zones[0].plants[0]?.strainId).toBe(NORTHERN_LIGHTS_ID);
    expect(second.world.company.structures[0].rooms[0].zones[1].plants[0]?.strainId).toBe(SOUR_DIESEL_ID);
  });

  it('sows a registered custom F1 from retained breeding stock at zero seed cost', () => {
    const ready = makeZoneReady(createDemoScenario({ companyName: 'Parents', seed: 'custom-f1-seed' }));
    const parent = resolveStrain(ready, NORTHERN_LIGHTS_ID)?.blueprint;
    if (!parent || !ready.breeding) throw new Error('Demo breeding state and parent are required.');
    const customId = intentId('custom-f1');
    const world: SimulationWorld = {
      ...ready,
      breeding: {
        ...ready.breeding,
        customStrainRegistry: [{ ...parent, id: customId, slug: 'custom-f1', name: 'Custom F1' }],
      },
    };
    const result = executePlantsSow(world, {
      ...sowCommand(world, customId, 1),
      intentId: intentId('custom-f1-sow'),
    });

    expect(result).toMatchObject({
      ok: true,
      seedCost: { unitPriceCc: 0, quantity: 1, amountCc: 0, booking: 'booked' },
    });
    if (!result.ok) return;
    expect(result.world.economy?.balanceCc).toBe(world.economy?.balanceCc);
    expect(result.world.company.structures[0].rooms[0].zones[0].plants[0]?.strainId).toBe(customId);
  });

  it('allows harvest to be followed by custom F1 sowing while retaining terminal plant history', () => {
    const ready = makeZoneReady(createDemoScenario({ companyName: 'Parents', seed: 'harvest-to-f1' }));
    const sown = executePlantsSow(ready, { ...sowCommand(ready, NORTHERN_LIGHTS_ID, 1), intentId: intentId('parent-sow') });
    if (!sown.ok) throw new Error(sown.message);
    const structure = sown.world.company.structures[0];
    const growroom = structure.rooms.find((room) => room.purpose === 'growroom')!;
    const zone = growroom.zones[0]!;
    const harvestReadyWorld: SimulationWorld = {
      ...sown.world,
      company: {
        ...sown.world.company,
        structures: [{
          ...structure,
          rooms: structure.rooms.map((room) => room.id === growroom.id ? {
            ...room,
            zones: room.zones.map((entry) => entry.id === zone.id ? {
              ...entry,
              plants: entry.plants.map((plant) => ({
                ...plant,
                lifecycleStage: 'harvest-ready' as const,
                readyForHarvest: true,
                biomass_g: 400,
              })),
            } : entry),
          } : room),
        }],
      },
    };
    const harvested = executePlantsHarvest(harvestReadyWorld, {
      intentId: intentId('parent-harvest'),
      structureId: structure.id,
      roomId: growroom.id,
      zoneId: zone.id,
      plantIds: [sown.plantIds[0]!],
    });
    if (!harvested.ok) throw new Error(harvested.message);
    const parent = resolveStrain(harvested.world, NORTHERN_LIGHTS_ID)?.blueprint;
    if (!parent || !harvested.world.breeding) throw new Error('Parent and breeding state are required.');
    const customId = intentId('journey-custom-f1');
    const selectedWorld: SimulationWorld = {
      ...harvested.world,
      economy: harvested.world.economy
        ? { ...harvested.world.economy, balanceCc: -100 }
        : undefined,
      breeding: {
        ...harvested.world.breeding,
        customStrainRegistry: [{ ...parent, id: customId, slug: 'journey-custom-f1', name: 'Journey Custom F1' }],
      },
    };
    const replanted = executePlantsSow(selectedWorld, {
      ...sowCommand(selectedWorld, customId, 1),
      intentId: intentId('custom-replant'),
    });

    expect(replanted.ok).toBe(true);
    if (!replanted.ok) return;
    const plants = replanted.world.company.structures[0].rooms
      .find((room) => room.id === growroom.id)!.zones[0]!.plants;
    expect(plants).toHaveLength(2);
    expect(plants[0]).toMatchObject({ id: sown.plantIds[0], status: 'harvested' });
    expect(plants[1]).toMatchObject({ strainId: customId, status: 'active' });
    expect(replanted.seedCost).toMatchObject({ amountCc: 0, balanceAfterCc: -100 });
    expect(replanted.world.economy?.ledger.at(-1)?.metadata).toEqual({
      strainId: customId,
      quantity: 1,
      unitPriceCc: 0,
    });
    const seedLedgerCount = replanted.world.economy?.ledger.length;
    const replay = executePlantsSow(replanted.world, {
      ...sowCommand(replanted.world, customId, 1),
      intentId: intentId('custom-replant'),
    });
    expect(replay).toMatchObject({ ok: true, replayed: true, seedCost: { amountCc: 0 } });
    expect(replay.world).toBe(replanted.world);
    expect(replay.world.economy?.ledger).toHaveLength(seedLedgerCount);
  });

  it('is deterministic and idempotent for the same seed and intent', () => {
    const firstWorld = makeZoneReady(createDemoScenario({ companyName: 'Parents', seed: 'repeat-seed' }));
    const secondWorld = makeZoneReady(createDemoScenario({ companyName: 'Parents', seed: 'repeat-seed' }));
    const first = executePlantsSow(firstWorld, sowCommand(firstWorld));
    const second = executePlantsSow(secondWorld, sowCommand(secondWorld));
    if (!first.ok || !second.ok) throw new Error('Sow should succeed.');

    expect(second.world).toStrictEqual(first.world);
    expect(second.plantIds).toEqual(first.plantIds);
    const replay = executePlantsSow(first.world, sowCommand(first.world));
    expect(replay).toMatchObject({ ok: true, replayed: true, plantIds: first.plantIds });
    expect(replay.world).toBe(first.world);
    expect(replay.world.economy?.ledger).toHaveLength(9);
  });

  it('replays legacy seed entries that predate structured metadata', () => {
    const world = makeZoneReady(createDemoScenario({ companyName: 'Parents', seed: 'legacy-seed-ledger' }));
    const first = executePlantsSow(world, sowCommand(world));
    if (!first.ok || !first.world.economy) throw new Error('Initial sow should succeed.');
    const legacyWorld: SimulationWorld = {
      ...first.world,
      economy: {
        ...first.world.economy,
        ledger: first.world.economy.ledger.map((entry) => entry.id === first.seedCost.ledgerEntryId
          ? { ...entry, metadata: undefined }
          : entry),
      },
    };

    const replay = executePlantsSow(legacyWorld, sowCommand(legacyWorld));
    expect(replay).toMatchObject({ ok: true, replayed: true });
    expect(replay.world).toBe(legacyWorld);
  });

  it('rejects invalid counts and cultivation density overflow', () => {
    const world = makeZoneReady(createDemoScenario({ companyName: 'Parents', seed: 'count-seed' }));

    expect(executePlantsSow(world, sowCommand(world, NORTHERN_LIGHTS_ID, 0))).toMatchObject({ ok: false, code: 'invalid_command', world });
    expect(executePlantsSow(world, sowCommand(world, NORTHERN_LIGHTS_ID, 1.5))).toMatchObject({ ok: false, code: 'invalid_command', world });
    expect(executePlantsSow(world, sowCommand(world, NORTHERN_LIGHTS_ID, 16))).toMatchObject({ ok: false, code: 'capacity_exceeded', world });
  });

  it('rejects unknown strains, non-ready zones, and non-empty zones', () => {
    const freshWorld = createDemoScenario({ companyName: 'Parents', seed: 'rejection-seed' });
    const unknownStrain = executePlantsSow(freshWorld, sowCommand(freshWorld, intentId('unknown-strain')));
    expect(unknownStrain).toMatchObject({ ok: false, code: 'strain_not_found', world: freshWorld });
    expect(executePlantsSow(freshWorld, sowCommand(freshWorld))).toMatchObject({
      ok: false,
      code: 'zone_not_ready',
      world: freshWorld,
    });

    const readyWorld = makeZoneReady(freshWorld);
    const first = executePlantsSow(readyWorld, sowCommand(readyWorld));
    if (!first.ok) throw new Error(first.message);
    expect(executePlantsSow(first.world, { ...sowCommand(first.world), intentId: intentId('second-sow') })).toMatchObject({
      ok: false,
      code: 'zone_not_empty',
      world: first.world,
    });
  });

  it('rejects a zone hosted by a non-growroom even if malformed state contains it', () => {
    const world = structuredClone(
      createDemoScenario({ companyName: 'Parents', seed: 'placement-seed' }),
    ) as DeepMutable<SimulationWorld>;
    const structure = world.company.structures[0];
    const growroom = structure.rooms.find((room) => room.purpose === 'growroom');
    const laboratory = structure.rooms.find((room) => room.purpose === 'laboratory');
    const zone = growroom?.zones[0];
    if (!growroom || !laboratory || !zone) throw new Error('Demo rooms and zone are required.');
    laboratory.zones = [zone];

    expect(executePlantsSow(world, {
      ...sowCommand(world),
      roomId: laboratory.id,
      zoneId: zone.id,
    })).toMatchObject({ ok: false, code: 'invalid_placement', world });
  });
});
