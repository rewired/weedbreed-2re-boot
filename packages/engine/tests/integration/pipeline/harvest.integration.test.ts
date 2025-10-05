import { beforeEach, describe, expect, it } from 'vitest';

import { runTick, type EngineDiagnostic, type EngineRunContext } from '@/backend/src/engine/Engine.js';
import { createDemoWorld, runStages } from '@/backend/src/engine/testHarness.js';
import type { Plant, Room, SimulationWorld, Zone } from '@/backend/src/domain/world.js';
import { clearStrainBlueprintCache } from '@/backend/src/domain/blueprints/strainBlueprintLoader.js';
import { WHITE_WIDOW_STRAIN_ID, createTestPlant } from '../../testUtils/strainFixtures.ts';

function firstZone(world: SimulationWorld): Zone {
  return world.company.structures[0].rooms[0].zones[0];
}

function firstStorageroom(world: SimulationWorld): Room | undefined {
  for (const structure of world.company.structures) {
    for (const room of structure.rooms) {
      if (room.purpose === 'storageroom') {
        return room;
      }
    }
  }

  return undefined;
}

function createHarvestReadyPlant(overrides: Partial<Plant> = {}): Plant {
  return createTestPlant({
    lifecycleStage: 'harvest-ready',
    biomass_g: 150,
    health01: 0.9,
    strainId: WHITE_WIDOW_STRAIN_ID,
    ...overrides
  });
}

describe('applyHarvestAndInventory pipeline', () => {
  beforeEach(() => {
    clearStrainBlueprintCache();
  });

  it('harvests harvest-ready plants and stores in storageroom', () => {
    const world = createDemoWorld();
    const zone = firstZone(world);
    zone.environment = { airTemperatureC: 23, relativeHumidity_pct: 55 } as Zone['environment'];
    zone.ppfd_umol_m2s = 600;
    zone.plants = [createHarvestReadyPlant({ slug: 'harvest-target' })];
    const ctx: EngineRunContext = { tickDurationHours: 1 };

    const { world: nextWorld } = runTick(world, ctx);
    const nextZone = firstZone(nextWorld);
    const storage = firstStorageroom(nextWorld)!;

    expect(nextZone.plants).toHaveLength(0);
    expect(storage.harvestLots).toHaveLength(1);
    const lot = storage.harvestLots![0];
    expect(lot.strainId).toBe(WHITE_WIDOW_STRAIN_ID);
    expect(lot.strainSlug).toBe('harvest-target');
    expect(lot.quality01).toBeGreaterThan(0.5);
    expect(lot.dryWeight_g).toBeGreaterThan(0);
    expect(lot.sourceZoneId).toBe(zone.id);
    expect(lot.harvestedAtSimHours).toBeGreaterThanOrEqual(world.simTimeHours);
  });

  it('calculates harvest quality based on health and stress', () => {
    const healthyWorld = createDemoWorld();
    const healthyZone = firstZone(healthyWorld);
    healthyZone.environment = { airTemperatureC: 23, relativeHumidity_pct: 55 } as Zone['environment'];
    healthyZone.ppfd_umol_m2s = 600;
    healthyZone.plants = [createHarvestReadyPlant({ slug: 'high-health', health01: 0.95 })];

    const { world: healthyNext } = runTick(healthyWorld, { tickDurationHours: 1 });
    const healthyLot = firstStorageroom(healthyNext)!.harvestLots?.find(
      (lot) => lot.strainSlug === 'high-health'
    );

    const stressedWorld = createDemoWorld();
    const stressedZone = firstZone(stressedWorld);
    stressedZone.environment = {
      airTemperatureC: 32,
      relativeHumidity_pct: 85
    } as Zone['environment'];
    stressedZone.ppfd_umol_m2s = 150;
    stressedZone.plants = [createHarvestReadyPlant({ slug: 'low-health', health01: 0.5 })];

    const { world: stressedNext } = runTick(stressedWorld, { tickDurationHours: 1 });
    const stressedLot = firstStorageroom(stressedNext)!.harvestLots?.find(
      (lot) => lot.strainSlug === 'low-health'
    );

    expect(healthyLot).toBeDefined();
    expect(stressedLot).toBeDefined();
    expect(healthyLot!.quality01).toBeGreaterThan(0.7);
    expect(stressedLot!.quality01).toBeLessThan(healthyLot!.quality01);
    expect(stressedLot!.quality01).toBeLessThan(0.65);
  });

  it('calculates harvest yield from biomass', () => {
    const world = createDemoWorld();
    const zone = firstZone(world);
    zone.environment = { airTemperatureC: 23, relativeHumidity_pct: 55 } as Zone['environment'];
    zone.ppfd_umol_m2s = 600;
    zone.plants = [
      createHarvestReadyPlant({ slug: 'small', biomass_g: 50 }),
      createHarvestReadyPlant({ slug: 'large', biomass_g: 200 })
    ];

    const { world: nextWorld } = runTick(world, { tickDurationHours: 1 });
    const storage = firstStorageroom(nextWorld)!;
    const lots = storage.harvestLots ?? [];
    const small = lots.find((lot) => lot.strainSlug === 'small');
    const large = lots.find((lot) => lot.strainSlug === 'large');

    expect(small).toBeDefined();
    expect(large).toBeDefined();
    expect(large!.dryWeight_g).toBeGreaterThan(small!.dryWeight_g);
    expect(large!.dryWeight_g).toBeLessThan(200);
  });

  it('emits diagnostic when storageroom is missing', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    structure.rooms = structure.rooms.filter((room) => room.purpose !== 'storageroom');
    const zone = firstZone(world);
    zone.environment = { airTemperatureC: 23, relativeHumidity_pct: 55 } as Zone['environment'];
    zone.ppfd_umol_m2s = 600;
    zone.plants = [createHarvestReadyPlant({ slug: 'no-storage' })];

    const diagnostics: EngineDiagnostic[] = [];
    const ctx: EngineRunContext = {
      tickDurationHours: 1,
      diagnostics: { emit: (diagnostic) => diagnostics.push(diagnostic) }
    } satisfies EngineRunContext;

    const nextWorld = runStages(world, ctx, ['applyHarvestAndInventory']);

    expect(diagnostics.some((d) => d.code === 'harvest.storageroom.missing')).toBe(true);
    expect(firstZone(nextWorld).plants).toHaveLength(1);
  });

  it('emits diagnostic when strain blueprint is missing', () => {
    const world = createDemoWorld();
    const zone = firstZone(world);
    zone.environment = { airTemperatureC: 23, relativeHumidity_pct: 55 } as Zone['environment'];
    zone.ppfd_umol_m2s = 600;
    zone.plants = [
      createHarvestReadyPlant({ slug: 'missing-strain', strainId: '11111111-2222-3333-4444-555555555555' as Plant['strainId'] })
    ];

    const diagnostics: EngineDiagnostic[] = [];
    const ctx: EngineRunContext = {
      tickDurationHours: 1,
      diagnostics: { emit: (diagnostic) => diagnostics.push(diagnostic) }
    } satisfies EngineRunContext;

    const nextWorld = runStages(world, ctx, ['applyHarvestAndInventory']);

    expect(diagnostics.some((d) => d.code === 'plant.strain.missing')).toBe(true);
    expect(firstZone(nextWorld).plants).toHaveLength(1);
    expect(firstStorageroom(nextWorld)?.harvestLots ?? []).toHaveLength(0);
  });

  it('harvests multiple plants from same zone', () => {
    const world = createDemoWorld();
    const zone = firstZone(world);
    zone.environment = { airTemperatureC: 23, relativeHumidity_pct: 55 } as Zone['environment'];
    zone.ppfd_umol_m2s = 650;
    zone.plants = [
      createHarvestReadyPlant({ slug: 'lot-1' }),
      createHarvestReadyPlant({ slug: 'lot-2' }),
      createHarvestReadyPlant({ slug: 'lot-3' })
    ];

    const { world: nextWorld } = runTick(world, { tickDurationHours: 1 });
    const nextZone = firstZone(nextWorld);
    const storage = firstStorageroom(nextWorld)!;

    expect(nextZone.plants).toHaveLength(0);
    expect(storage.harvestLots).toHaveLength(3);
  });

  it('harvests plants from multiple zones', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const room = structure.rooms[0];
    const baseZone = firstZone(world);
    const secondZone: Zone = {
      ...baseZone,
      id: '77777777-7777-4777-8777-777777777777' as Zone['id'],
      name: 'Zone B',
      slug: 'zone-b',
      plants: [createHarvestReadyPlant({ slug: 'zone-b-plant', id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' as Plant['id'] })]
    };
    room.zones = [
      {
        ...baseZone,
        plants: [createHarvestReadyPlant({ slug: 'zone-a-plant' })]
      },
      secondZone
    ];

    room.zones.forEach((z) => {
      z.environment = { airTemperatureC: 23, relativeHumidity_pct: 55 } as Zone['environment'];
      z.ppfd_umol_m2s = 600;
    });

    const { world: nextWorld } = runTick(world, { tickDurationHours: 1 });
    const nextRoom = nextWorld.company.structures[0].rooms[0];
    expect(nextRoom.zones[0].plants).toHaveLength(0);
    expect(nextRoom.zones[1].plants).toHaveLength(0);
    const storage = firstStorageroom(nextWorld)!;
    const lots = storage.harvestLots ?? [];
    expect(lots).toHaveLength(2);
    const zoneIds = new Set(lots.map((lot) => lot.sourceZoneId));
    expect(zoneIds.size).toBe(2);
  });

  it('does not harvest plants in other lifecycle stages', () => {
    const world = createDemoWorld();
    const zone = firstZone(world);
    zone.environment = { airTemperatureC: 23, relativeHumidity_pct: 55 } as Zone['environment'];
    zone.ppfd_umol_m2s = 600;
    zone.plants = [
      createTestPlant({ lifecycleStage: 'seedling', slug: 'seedling' }),
      createTestPlant({ lifecycleStage: 'vegetative', slug: 'veg' }),
      createTestPlant({ lifecycleStage: 'flowering', slug: 'flower' })
    ];

    const { world: nextWorld } = runTick(world, { tickDurationHours: 1 });
    const nextZone = firstZone(nextWorld);
    expect(nextZone.plants).toHaveLength(3);
    const storage = firstStorageroom(nextWorld)!;
    expect(storage.harvestLots).toHaveLength(0);
  });

  it('harvests after full lifecycle progression', () => {
    const world = createDemoWorld();
    const zone = firstZone(world);
    zone.environment = { airTemperatureC: 24, relativeHumidity_pct: 55 } as Zone['environment'];
    zone.ppfd_umol_m2s = 600;
    zone.dli_mol_m2d_inc = 0.6;
    zone.plants = [
      createTestPlant({
        lifecycleStage: 'seedling',
        ageHours: 0,
        biomass_g: 5,
        slug: 'full-cycle',
        health01: 0.95
      })
    ];

    const ctx: EngineRunContext = { tickDurationHours: 1 };
    let currentWorld = world;
    let guard = 0;

    while (guard < 3500) {
      const zoneRef = firstZone(currentWorld);

      if (zoneRef.plants.length === 0) {
        break;
      }

      const currentStage = zoneRef.plants[0].lifecycleStage;

      if (currentStage === 'vegetative') {
        zoneRef.photoperiodPhase = 'flowering';
        zoneRef.lightSchedule = { onHours: 12, offHours: 12, startHour: 0 } as Zone['lightSchedule'];
      }

      if (currentStage === 'harvest-ready') {
        break;
      }

      currentWorld = runStages(currentWorld, ctx, ['advancePhysiology']);
      guard += 1;
    }

    const readyZone = firstZone(currentWorld);
    expect(readyZone.plants).not.toHaveLength(0);
    expect(readyZone.plants[0].lifecycleStage).toBe('harvest-ready');

    const { world: harvestedWorld } = runTick(currentWorld, ctx);
    const finalZone = firstZone(harvestedWorld);
    const storage = firstStorageroom(harvestedWorld)!;

    expect(finalZone.plants).toHaveLength(0);
    expect(storage.harvestLots).not.toHaveLength(0);
    const finalLot = storage.harvestLots!.find((lot) => lot.strainSlug === 'full-cycle');
    expect(finalLot).toBeDefined();
    expect(finalLot!.quality01).toBeGreaterThan(0.7);
  });
});
