import { describe, expect, it } from 'vitest';

import {
  createDemoScenario,
  executeDevicePurchaseInstall,
  executeRoomCreate,
  executeZoneCreate,
  type RoomCreateCommand,
  type SimulationWorld,
} from '@wb/engine';
import { loadDemoScenarioBlueprints } from '@/backend/src/scenarios/demoScenarioBlueprints';
import { deterministicUuid } from '@/backend/src/util/uuid';

const LIGHT_BLUEPRINT_ID = '3b5f6ad7-672e-47cd-9a24-f0cc45c4101e';

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;

function commandId(label: string): string {
  return deterministicUuid('facility-command-tests', label);
}

function createWorldWithFreeStructureCapacity(): SimulationWorld {
  const world = structuredClone(createDemoScenario({ companyName: 'Facility Test', seed: 'room-seed' })) as DeepMutable<SimulationWorld>;
  world.company.structures[0].rooms = world.company.structures[0].rooms.filter(
    (room) => room.purpose !== 'laboratory',
  );
  return world;
}

function createWorldWithFreeGrowroomCapacity(): SimulationWorld {
  const world = structuredClone(createDemoScenario({ companyName: 'Facility Test', seed: 'zone-seed' })) as DeepMutable<SimulationWorld>;
  const growroom = world.company.structures[0].rooms.find((room) => room.purpose === 'growroom');
  if (!growroom) {
    throw new Error('Demo growroom is required.');
  }
  growroom.zones = growroom.zones.slice(0, 1);
  return world;
}

describe('facility commands', () => {
  it('creates a room immutably and replays the same intent without duplication', () => {
    const world = createWorldWithFreeStructureCapacity();
    const structure = world.company.structures[0];
    const command = {
      intentId: commandId('room-success'),
      structureId: structure.id,
      name: 'Second Growroom',
      purpose: 'growroom',
      floorArea_m2: 5,
    } as const;
    const first = executeRoomCreate(world, command);

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(world.company.structures[0].rooms).toHaveLength(2);
    expect(first.world.company.structures[0].rooms).toHaveLength(3);
    expect(first.replayed).toBe(false);

    const replay = executeRoomCreate(first.world, command);
    expect(replay).toMatchObject({ ok: true, replayed: true, entityId: first.entityId });
    expect(replay.world).toBe(first.world);
  });

  it('rejects invalid room purpose, area quantum, and structure capacity', () => {
    const world = createWorldWithFreeStructureCapacity();
    const structureId = world.company.structures[0].id;
    const base = { intentId: commandId('room-reject'), structureId, name: 'Room' };
    const invalidPurpose = executeRoomCreate(world, {
      ...base,
      purpose: 'garage',
      floorArea_m2: 1,
    } as RoomCreateCommand);
    const invalidArea = executeRoomCreate(world, { ...base, purpose: 'workshop', floorArea_m2: 0.3 });
    const overCapacity = executeRoomCreate(world, { ...base, purpose: 'workshop', floorArea_m2: 20 });

    expect(invalidPurpose).toMatchObject({ ok: false, code: 'invalid_command', world });
    expect(invalidArea).toMatchObject({ ok: false, code: 'invalid_command', world });
    expect(overCapacity).toMatchObject({ ok: false, code: 'insufficient_capacity', world });
  });

  it('creates a compatible empty zone and deterministically replays its intent', () => {
    const world = createWorldWithFreeGrowroomCapacity();
    const structure = world.company.structures[0];
    const growroom = structure.rooms.find((room) => room.purpose === 'growroom');
    const blueprints = loadDemoScenarioBlueprints();
    if (!growroom) throw new Error('Demo growroom is required.');
    const command = {
      intentId: commandId('zone-success'),
      structureId: structure.id,
      roomId: growroom.id,
      name: 'New Soil Zone',
      floorArea_m2: 7.5,
      cultivationMethodId: blueprints.cultivationMethod.id,
      containerId: blueprints.container.id,
      substrateId: blueprints.substrate.id,
      irrigationMethodId: blueprints.irrigation.id,
    };
    const first = executeZoneCreate(world, command);

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(growroom.zones).toHaveLength(1);
    const nextGrowroom = first.world.company.structures[0].rooms.find((room) => room.id === growroom.id);
    expect(nextGrowroom?.zones).toHaveLength(2);
    expect(nextGrowroom?.zones[1]).toMatchObject({ plants: [], devices: [] });

    const replay = executeZoneCreate(first.world, command);
    expect(replay).toMatchObject({ ok: true, replayed: true, entityId: first.entityId });
  });

  it('rejects zones outside growrooms, incompatible references, and excess capacity', () => {
    const freeWorld = createWorldWithFreeGrowroomCapacity();
    const structure = freeWorld.company.structures[0];
    const growroom = structure.rooms.find((room) => room.purpose === 'growroom');
    const storage = structure.rooms.find((room) => room.purpose === 'storageroom');
    const blueprints = loadDemoScenarioBlueprints();
    if (!growroom || !storage) throw new Error('Demo rooms are required.');
    const base = {
      intentId: commandId('zone-reject'),
      structureId: structure.id,
      roomId: growroom.id,
      floorArea_m2: 7.5,
      cultivationMethodId: blueprints.cultivationMethod.id,
      containerId: blueprints.container.id,
      substrateId: blueprints.substrate.id,
      irrigationMethodId: blueprints.irrigation.id,
    };

    expect(executeZoneCreate(freeWorld, { ...base, roomId: storage.id })).toMatchObject({
      ok: false,
      code: 'invalid_placement',
      world: freeWorld,
    });
    expect(executeZoneCreate(freeWorld, { ...base, containerId: commandId('unknown-container') })).toMatchObject({
      ok: false,
      code: 'incompatible_configuration',
    });
    expect(executeZoneCreate(freeWorld, { ...base, irrigationMethodId: '' })).toMatchObject({
      ok: false,
      code: 'invalid_command',
      world: freeWorld,
    });
    const fullWorld = createDemoScenario({ companyName: 'Facility Test', seed: 'full-zone-seed' });
    const fullStructure = fullWorld.company.structures[0];
    const fullGrowroom = fullStructure.rooms.find((room) => room.purpose === 'growroom');
    if (!fullGrowroom) throw new Error('Demo growroom is required.');
    expect(executeZoneCreate(fullWorld, {
      ...base,
      structureId: fullStructure.id,
      roomId: fullGrowroom.id,
      intentId: commandId('zone-capacity'),
      floorArea_m2: 0.25,
    })).toMatchObject({ ok: false, code: 'insufficient_capacity', world: fullWorld });
  });

  it('installs a priced device immutably and books CapEx plus coverage', () => {
    const world = createDemoScenario({ companyName: 'Facility Test', seed: 'device-seed' });
    const structure = world.company.structures[0];
    const growroom = structure.rooms.find((room) => room.purpose === 'growroom');
    const zone = growroom?.zones[0];
    if (!growroom || !zone) throw new Error('Demo zone is required.');
    const command = {
      intentId: commandId('device-success'),
      structureId: structure.id,
      roomId: growroom.id,
      zoneId: zone.id,
      deviceBlueprintId: LIGHT_BLUEPRINT_ID,
    };
    const first = executeDevicePurchaseInstall(world, command);

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(zone.devices).toHaveLength(0);
    expect(first.purchaseCost).toMatchObject({
      amountCc: 600,
      booking: 'booked',
      balanceAfterCc: 19_400,
    });
    expect(first.world.economy?.ledger).toEqual([
      expect.objectContaining({ category: 'capital_expenditure', direction: 'debit', amountCc: 600 }),
    ]);
    expect(first.coverage).toMatchObject({
      installedCoverage_m2: 1.2,
      totalBlueprintCoverage_m2: 1.2,
      requiredCoverage_m2: 7.5,
      sufficient: false,
    });

    const replay = executeDevicePurchaseInstall(first.world, command);
    expect(replay).toMatchObject({ ok: true, replayed: true, entityId: first.entityId });
    expect(replay.world).toBe(first.world);
    expect(replay.world.economy?.ledger).toHaveLength(1);
  });

  it('rejects unknown device blueprints without changing the world', () => {
    const world = createDemoScenario({ companyName: 'Facility Test', seed: 'device-reject-seed' });
    const structure = world.company.structures[0];
    const growroom = structure.rooms.find((room) => room.purpose === 'growroom');
    const zone = growroom?.zones[0];
    if (!growroom || !zone) throw new Error('Demo zone is required.');

    expect(executeDevicePurchaseInstall(world, {
      intentId: commandId('unknown-device'),
      structureId: structure.id,
      roomId: growroom.id,
      zoneId: zone.id,
      deviceBlueprintId: commandId('unknown-blueprint'),
    })).toMatchObject({ ok: false, code: 'blueprint_not_found', world });
  });

  it('rejects device placement when the hosting room purpose is not allowed', () => {
    const world = structuredClone(
      createDemoScenario({ companyName: 'Facility Test', seed: 'device-placement-seed' }),
    ) as DeepMutable<SimulationWorld>;
    const structure = world.company.structures[0];
    const growroom = structure.rooms.find((room) => room.purpose === 'growroom');
    const laboratory = structure.rooms.find((room) => room.purpose === 'laboratory');
    const zone = growroom?.zones[0];
    if (!growroom || !laboratory || !zone) throw new Error('Demo rooms and zone are required.');
    laboratory.zones = [zone];

    expect(executeDevicePurchaseInstall(world, {
      intentId: commandId('invalid-device-placement'),
      structureId: structure.id,
      roomId: laboratory.id,
      zoneId: zone.id,
      deviceBlueprintId: LIGHT_BLUEPRINT_ID,
    })).toMatchObject({ ok: false, code: 'invalid_placement', world });
  });

  it('derives different entity IDs from another world seed', () => {
    const makeCommand = (world: SimulationWorld) => ({
      intentId: commandId('cross-seed-room'),
      structureId: world.company.structures[0].id,
      name: 'Workshop',
      purpose: 'workshop' as const,
      floorArea_m2: 5,
    });
    const firstWorld = createWorldWithFreeStructureCapacity();
    const secondWorld = structuredClone(firstWorld) as DeepMutable<SimulationWorld>;
    secondWorld.seed = 'different-world-seed';
    const first = executeRoomCreate(firstWorld, makeCommand(firstWorld));
    const second = executeRoomCreate(secondWorld, makeCommand(secondWorld));

    expect(first.ok && second.ok && first.entityId).not.toBe(second.ok ? second.entityId : undefined);
  });
});
